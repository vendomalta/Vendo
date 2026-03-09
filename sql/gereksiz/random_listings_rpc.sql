CREATE OR REPLACE FUNCTION get_listings_random(seed double precision, limit_count int, offset_count int, search_term text DEFAULT '')
RETURNS SETOF listings AS $$
BEGIN
  -- Set the seed for randomization to ensure consistent pagination within a session
  PERFORM setseed(seed);
  
  RETURN QUERY SELECT * FROM listings 
  WHERE status = 'active'
    AND (search_term = '' OR title ILIKE '%' || search_term || '%')
  ORDER BY random()
  LIMIT limit_count OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;
