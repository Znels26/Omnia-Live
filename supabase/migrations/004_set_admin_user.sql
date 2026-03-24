-- Set admin role for the owner account
update profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'zacharynelson96@gmail.com'
);
