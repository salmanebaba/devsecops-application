CREATE TABLE users (
  id uuid PRIMARY KEY,
  email varchar(254) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_normalized CHECK (email = lower(email))
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL CHECK (length(trim(title)) > 0),
  description varchar(2000) NOT NULL DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tasks_owner_created_idx ON tasks (owner_id, created_at DESC, id DESC);

GRANT USAGE ON SCHEMA public TO lab_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, tasks TO lab_app_user;
GRANT SELECT ON schema_migrations TO lab_app_user;
