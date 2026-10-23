-- 005_seed_admin.sql
-- Idempotent bootstrap of the initial Admin login and one default store.
-- Runs AFTER 001..004 so the roles/users/restaurants tables and the
-- account_status / token_version columns already exist.
--
-- Default credentials: username "admin" / password "admin123".
-- Change the password from the Users page (or via change-password) right after
-- the first successful login. The bcrypt hash below is for "admin123".

-- 1. Admin role (roles.name is UNIQUE)
INSERT INTO roles (name, permissions)
VALUES ('Admin', '{"POS": true, "Inventory": true, "Reports": true, "UserMgmt": true, "Settings": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 2. Default store so the admin has somewhere to be assigned.
--    Only inserted when the table is empty; the app also seeds its own on boot.
INSERT INTO restaurants (name, address, currency, business_type)
SELECT 'SIVARA Main Branch', 'Hospitality Hub', 'USD', 'restaurant'
WHERE NOT EXISTS (SELECT 1 FROM restaurants);

-- 3. Admin user (users.username is UNIQUE).
INSERT INTO users (username, password, role_id, is_active, account_status, full_name)
SELECT 'admin',
       '$2b$10$xWkCCJpL.UU9ToBGq1i4cOB9UANaAe4Jfvl3LeRX6w7axBEt.p1wW',
       (SELECT id FROM roles WHERE name = 'Admin'),
       TRUE,
       'active',
       'System Administrator'
ON CONFLICT (username) DO NOTHING;

-- 4. Grant the admin access to every store (pivot is UNIQUE(user_id, restaurant_id)).
INSERT INTO user_restaurant_access (user_id, restaurant_id, is_default)
SELECT u.id, r.id, (r.id = (SELECT MIN(id) FROM restaurants))
FROM users u
CROSS JOIN restaurants r
WHERE u.username = 'admin'
ON CONFLICT (user_id, restaurant_id) DO NOTHING;
