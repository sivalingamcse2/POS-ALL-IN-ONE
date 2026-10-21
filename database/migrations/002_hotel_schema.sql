-- New Trading Hotel: rooms, events, and order extensions

CREATE TABLE IF NOT EXISTS rooms (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
  room_number VARCHAR(20) NOT NULL,
  guest_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'vacant',
  floor INTEGER,
  room_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(restaurant_id, room_number)
);

CREATE TABLE IF NOT EXISTS banquet_events (
  id SERIAL PRIMARY KEY,
  restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  guest_count INTEGER DEFAULT 0,
  package_name VARCHAR(100),
  deposit_status VARCHAR(20) DEFAULT 'Pending',
  deposit_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_type VARCHAR(30) DEFAULT 'dine-in';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS room_number VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS charge_to_room BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_rooms_restaurant ON rooms(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_orders_service_type ON orders(service_type);
CREATE INDEX IF NOT EXISTS idx_banquet_events_restaurant ON banquet_events(restaurant_id);
