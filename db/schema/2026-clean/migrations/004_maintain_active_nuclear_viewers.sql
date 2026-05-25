-- 004_maintain_active_nuclear_viewers.sql
-- Maintains node_active_nuclear_viewers (father-centric nuclear family visibility)
--
-- RULES (as per product requirement):
-- - Father is the anchor/patokan for active keluarga inti.
-- - Triggers fire on marriages and parent_child_relations.
-- - Spouse relation → updates active nuclear (adds wife to husband's nuclear).
-- - Child relation → child inherits visibility from father's current active nuclear.
-- - When father divorces (future), wife is removed from the active nuclear of father and his children.
-- - Old feed snapshots (feed_nuclear_viewers) are NEVER modified retroactively.
--   Only new feeds after the change will see the updated active nuclear.

-- ============================================================================
-- FUNCTION: Rebuild active nuclear viewers for a given node (father-centric)
-- ============================================================================
CREATE OR REPLACE FUNCTION rebuild_active_nuclear_viewers(p_node_id INTEGER)
RETURNS VOID AS $$
DECLARE
    v_father_id INTEGER;
    v_current_wife_id INTEGER;
BEGIN
    -- Clear current active viewers for this node
    DELETE FROM node_active_nuclear_viewers WHERE node_id = p_node_id;

    -- Always include self
    INSERT INTO node_active_nuclear_viewers (node_id, viewer_node_id)
    VALUES (p_node_id, p_node_id)
    ON CONFLICT DO NOTHING;

    -- Find the father of this node (if any)
    SELECT parent_node_id INTO v_father_id
    FROM parent_child_relations
    WHERE child_node_id = p_node_id AND parent_type = 'father'
    LIMIT 1;

    IF v_father_id IS NOT NULL THEN
        -- Include the father
        INSERT INTO node_active_nuclear_viewers (node_id, viewer_node_id)
        VALUES (p_node_id, v_father_id)
        ON CONFLICT DO NOTHING;

        -- Include father's current wife (if married)
        SELECT 
            CASE 
                WHEN m.husband_node_id = v_father_id THEN m.wife_node_id 
                ELSE m.husband_node_id 
            END
        INTO v_current_wife_id
        FROM marriages m
        WHERE (m.husband_node_id = v_father_id OR m.wife_node_id = v_father_id)
          AND m.status = 'married'
        LIMIT 1;

        IF v_current_wife_id IS NOT NULL THEN
            INSERT INTO node_active_nuclear_viewers (node_id, viewer_node_id)
            VALUES (p_node_id, v_current_wife_id)
            ON CONFLICT DO NOTHING;
        END IF;

        -- Include siblings (other children of the same father)
        INSERT INTO node_active_nuclear_viewers (node_id, viewer_node_id)
        SELECT p_node_id, pcr.child_node_id
        FROM parent_child_relations pcr
        WHERE pcr.parent_node_id = v_father_id 
          AND pcr.parent_type = 'father'
          AND pcr.child_node_id != p_node_id
        ON CONFLICT DO NOTHING;
    END IF;

    -- If this node is a father himself, include his current wife + his children
    -- (his own nuclear family on top of his father's nuclear)
    INSERT INTO node_active_nuclear_viewers (node_id, viewer_node_id)
    SELECT p_node_id, 
           CASE 
               WHEN m.husband_node_id = p_node_id THEN m.wife_node_id 
               ELSE m.husband_node_id 
           END
    FROM marriages m
    WHERE (m.husband_node_id = p_node_id OR m.wife_node_id = p_node_id)
      AND m.status = 'married'
    ON CONFLICT DO NOTHING;

    -- Include own children
    INSERT INTO node_active_nuclear_viewers (node_id, viewer_node_id)
    SELECT p_node_id, pcr.child_node_id
    FROM parent_child_relations pcr
    WHERE pcr.parent_node_id = p_node_id 
      AND pcr.parent_type = 'father'
    ON CONFLICT DO NOTHING;

END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger on parent_child_relations (after insert/delete)
CREATE OR REPLACE FUNCTION trg_parent_child_nuclear_update()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Rebuild for the child
        PERFORM rebuild_active_nuclear_viewers(NEW.child_node_id);
        -- Also rebuild for the parent (in case they are a father)
        PERFORM rebuild_active_nuclear_viewers(NEW.parent_node_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM rebuild_active_nuclear_viewers(OLD.child_node_id);
        PERFORM rebuild_active_nuclear_viewers(OLD.parent_node_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pcr_nuclear ON parent_child_relations;
CREATE TRIGGER trg_pcr_nuclear
AFTER INSERT OR DELETE ON parent_child_relations
FOR EACH ROW EXECUTE FUNCTION trg_parent_child_nuclear_update();

-- Trigger on marriages (status changes are important)
CREATE OR REPLACE FUNCTION trg_marriage_nuclear_update()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Rebuild for both husband and wife
        PERFORM rebuild_active_nuclear_viewers(NEW.husband_node_id);
        PERFORM rebuild_active_nuclear_viewers(NEW.wife_node_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM rebuild_active_nuclear_viewers(OLD.husband_node_id);
        PERFORM rebuild_active_nuclear_viewers(OLD.wife_node_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marriage_nuclear ON marriages;
CREATE TRIGGER trg_marriage_nuclear
AFTER INSERT OR UPDATE OR DELETE ON marriages
FOR EACH ROW EXECUTE FUNCTION trg_marriage_nuclear_update();

-- ============================================================================
-- INITIAL DATA (optional - can be run manually after migration if needed)
-- ============================================================================
-- You can run this after applying the migration to backfill for existing data:
-- SELECT rebuild_active_nuclear_viewers(id) FROM nodes;