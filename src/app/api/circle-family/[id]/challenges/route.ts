import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db_helper';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const halaqahId = params.id;

    // 1. Fetch the latest active challenge
    const challengeRes = await pool.query(
      'SELECT * FROM challenges WHERE halaqah_id = $1 ORDER BY created_at DESC LIMIT 1',
      [halaqahId]
    );
    const activeChallenge = challengeRes.rows[0];

    if (!activeChallenge) {
      return NextResponse.json({
        challenge: null,
        submissions: []
      });
    }

    // 2. Fetch submissions for this challenge from other families
    const submissionsRes = await pool.query(
      `SELECT cs.*, nf.name as family_name
       FROM challenge_submissions cs
       JOIN nuclear_families nf ON cs.nuclear_family_id = nf.id
       WHERE cs.challenge_id = $1
       ORDER BY cs.created_at DESC`,
      [activeChallenge.id]
    );

    return NextResponse.json({
      challenge: activeChallenge,
      submissions: submissionsRes.rows,
    });
  } catch (error) {
    console.error('Get Challenges error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const halaqahId = params.id;
    const body = await request.json();
    const { challenge_id, content_url, description } = body;

    if (!challenge_id) {
      return NextResponse.json({ error: 'ID tantangan diperlukan' }, { status: 400 });
    }

    // 1. Find the user's nuclear family id
    const nfRes = await pool.query(
      `SELECT current_nuclear_family_id FROM nodes WHERE user_id = $1`,
      [auth.userId]
    );
    const nuclearFamilyId = nfRes.rows[0]?.current_nuclear_family_id;

    if (!nuclearFamilyId) {
      return NextResponse.json({ error: 'Keluarga inti tidak ditemukan' }, { status: 400 });
    }

    // 2. Upsert the submission
    await pool.query(
      `INSERT INTO challenge_submissions (challenge_id, nuclear_family_id, content_url, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (challenge_id, nuclear_family_id)
       DO UPDATE SET content_url = EXCLUDED.content_url, description = EXCLUDED.description`,
      [challenge_id, nuclearFamilyId, content_url, description]
    );

    return NextResponse.json({ message: 'Hasil praktik berhasil dikirim!' });
  } catch (error) {
    console.error('Submit Challenge error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
