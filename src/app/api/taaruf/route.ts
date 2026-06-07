import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db_helper";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { userId } = auth;

  const client = await pool.connect();

  try {
    // 1. Check if user has spouse + get spouse data
    const marriageRes = await client.query(
      `SELECT m.id, m.husband_node_id, m.wife_node_id, m.marriage_date,
              hn.full_name as husband_name, hn.photo_url as husband_photo,
              wn.full_name as wife_name, wn.photo_url as wife_photo
       FROM marriages m
       JOIN nodes n ON (m.husband_node_id = n.id OR m.wife_node_id = n.id)
       LEFT JOIN nodes hn ON hn.id = m.husband_node_id
       LEFT JOIN nodes wn ON wn.id = m.wife_node_id
       WHERE n.user_id = $1 AND m.status = 'married'`,
      [userId],
    );

    const hasSpouse = marriageRes.rows.length > 0;
    const spouseData = hasSpouse ? marriageRes.rows[0] : null;

    // Determine user's gender
    const marriageCheck = await client.query(
      `SELECT 1 FROM marriages m
       JOIN nodes hn ON hn.id = m.husband_node_id
       WHERE hn.user_id = $1 AND m.status = 'married'`,
      [userId],
    );
    const isHusband = marriageCheck.rows.length > 0;

    // 2. Get user's node and gender
    const userNodeRes = await client.query(
      `SELECT id, gender, full_name, birth_date, photo_url 
       FROM nodes 
       WHERE user_id = $1 
       LIMIT 1`,
      [userId],
    );

    const userNode = userNodeRes.rows[0] || null;
    const userGender = userNode?.gender;

    // 3. Get my taaruf profile
    const myProfileRes = await client.query(
      `SELECT tp.*, tc.age_min, tc.age_max, tc.preferred_education, tc.preferred_location, tc.preferred_marital_status
       FROM taaruf_profiles tp
       LEFT JOIN taaruf_criteria tc ON tc.profile_id = tp.id
       WHERE tp.user_id = $1
       LIMIT 1`,
      [userId],
    );

    const myProfile = myProfileRes.rows[0] || null;

    // 4. Get outgoing application (for male users)
    let outgoingApplication = null;
    if (userGender === "male") {
      const outgoingRes = await client.query(
        `SELECT ta.*, tp.full_name as recipient_name
         FROM taaruf_applications ta
         JOIN taaruf_profiles tp ON tp.id = ta.recipient_profile_id
         WHERE ta.sender_profile_id = $1
         AND ta.status IN ('pending', 'accepted')
         ORDER BY ta.created_at DESC
         LIMIT 1`,
        [myProfile?.id],
      );
      outgoingApplication = outgoingRes.rows[0] || null;
    }

    // 5. Get incoming applications (for female users)
    let incomingApplications: any[] = [];
    if (userGender === "female") {
      const incomingRes = await client.query(
        `SELECT ta.*, tp.full_name as sender_name, tp.occupation as sender_occupation,
                tp.location as sender_location, tp.interests as sender_interests, tp.about_me, tp.photo_url
         FROM taaruf_applications ta
         JOIN taaruf_profiles tp ON tp.id = ta.sender_profile_id
         WHERE ta.recipient_profile_id = $1
         AND ta.status = 'pending'
         ORDER BY ta.created_at DESC`,
        [myProfile?.id],
      );
      incomingApplications = incomingRes.rows;
    }

    // 6. Get matched room (if any)
    let matchedRoom = null;
    if (
      outgoingApplication?.status === "accepted" ||
      (userGender === "female" &&
        incomingApplications.some((app) => app.status === "accepted"))
    ) {
      const acceptedApp =
        outgoingApplication?.status === "accepted"
          ? outgoingApplication
          : incomingApplications.find((app) => app.status === "accepted");

      if (acceptedApp?.chat_room_id) {
        const roomRes = await client.query(
          `SELECT cr.id, cr.name, cr.family_uuid 
           FROM chat_rooms cr 
           WHERE cr.id = $1`,
          [acceptedApp.chat_room_id],
        );

        if (roomRes.rows[0]) {
          matchedRoom = {
            id: roomRes.rows[0].id,
            name: roomRes.rows[0].name,
          };
        }
      }
    }

    // 7. Get available profiles (opposite gender, for male swiping)
    let availableProfiles: any[] = [];
    if (
      userGender === "male" &&
      myProfile?.status === "active" &&
      !outgoingApplication
    ) {
      const availableRes = await client.query(
        `SELECT tp.*, n.uuid as node_uuid
         FROM taaruf_profiles tp
         JOIN nodes n ON n.id = tp.node_id
         WHERE tp.status = 'active'
         AND n.gender = 'female'
         AND n.user_id != $1
         AND tp.id NOT IN (
           SELECT recipient_profile_id FROM taaruf_applications 
           WHERE sender_profile_id = $2
         )
         AND NOT EXISTS (
           SELECT 1 FROM marriages m
           WHERE (m.husband_node_id = n.id OR m.wife_node_id = n.id)
           AND m.status = 'married'
         )
         ORDER BY RANDOM()
         LIMIT 20`,
        [userId, myProfile?.id],
      );
      availableProfiles = availableRes.rows;
    }

    return NextResponse.json({
      has_spouse: hasSpouse,
      spouse: hasSpouse
        ? {
            full_name: isHusband
              ? spouseData.husband_name
              : spouseData.wife_name,
            partner_name: isHusband
              ? spouseData.wife_name
              : spouseData.husband_name,
            partner_photo: isHusband
              ? spouseData.wife_photo
              : spouseData.husband_photo,
            marriage_date: spouseData.marriage_date,
          }
        : null,
      my_profile: myProfile,
      gender: userGender,
      outgoing_application: outgoingApplication,
      incoming_applications: incomingApplications,
      matched_room: matchedRoom,
      available_profiles: availableProfiles,
    });
  } catch (error) {
    console.error("GET /api/taaruf error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data ta'aruf" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { userId } = auth;
  const body = await request.json();
  const {
    location,
    education_level,
    occupation,
    about_me,
    interests,
    photo_url,
    cover_photo,
    criteria,
    letter,
  } = body;

  const client = await pool.connect();

  try {
    const userNodeRes = await client.query(
      "SELECT id, full_name FROM nodes WHERE user_id = $1 LIMIT 1",
      [userId],
    );

    if (userNodeRes.rows.length === 0) {
      return NextResponse.json(
        { error: "Node pengguna tidak ditemukan" },
        { status: 404 },
      );
    }

    const nodeId = userNodeRes.rows[0].id;
    const fullName = userNodeRes.rows[0].full_name;

    const existingProfileRes = await client.query(
      "SELECT id FROM taaruf_profiles WHERE user_id = $1 LIMIT 1",
      [userId],
    );

    let profileId: number;

    if (existingProfileRes.rows.length > 0) {
      profileId = existingProfileRes.rows[0].id;
      await client.query(
        `UPDATE taaruf_profiles 
         SET location = $1, education_level = $2, occupation = $3, about_me = $4, 
             interests = $5, photo_url = $6, cover_photo = $7, status = 'active', updated_at = NOW()
         WHERE id = $8`,
        [
          location,
          education_level,
          occupation,
          about_me,
          interests,
          photo_url,
          cover_photo,
          profileId,
        ],
      );
    } else {
      const insertRes = await client.query(
        `INSERT INTO taaruf_profiles 
         (user_id, node_id, full_name, location, education_level, occupation, about_me, 
          interests, photo_url, cover_photo, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', NOW(), NOW())
         RETURNING id`,
        [
          userId,
          nodeId,
          fullName,
          location,
          education_level,
          occupation,
          about_me,
          interests,
          photo_url,
          cover_photo,
        ],
      );
      profileId = insertRes.rows[0].id;
    }

    if (criteria) {
      const existingCriteriaRes = await client.query(
        "SELECT id FROM taaruf_criteria WHERE profile_id = $1 LIMIT 1",
        [profileId],
      );

      if (existingCriteriaRes.rows.length > 0) {
        await client.query(
          `UPDATE taaruf_criteria 
           SET age_min = $1, age_max = $2, preferred_education = $3, 
               preferred_location = $4, preferred_marital_status = $5, updated_at = NOW()
           WHERE profile_id = $6`,
          [
            criteria.age_min,
            criteria.age_max,
            criteria.preferred_education,
            criteria.preferred_location,
            criteria.preferred_marital_status,
            profileId,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO taaruf_criteria 
           (profile_id, age_min, age_max, preferred_education, preferred_location, 
            preferred_marital_status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
          [
            profileId,
            criteria.age_min,
            criteria.age_max,
            criteria.preferred_education,
            criteria.preferred_location,
            criteria.preferred_marital_status,
          ],
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: "Profil kamu berhasil disimpan",
      profile_id: profileId,
    });
  } catch (error) {
    console.error("POST /api/taaruf error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan profil kamu" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
