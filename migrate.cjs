const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gkvoluaetwaqmnpocqee.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrdm9sdWFldHdhcW1ucG9jcWVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzQ1OTc3OSwiZXhwIjoyMDk5MDM1Nzc5fQ.nc758KNro9f9whYuPe0S1wwi5TFQplQl3nJINS5-9DY';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function main() {
  console.log('Starting migration and user confirmation...');
  try {
    const email = 'kushaldemo123@gmail.com';
    console.log(`Checking for user: ${email}...`);
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) throw listError;

    const user = users.find(u => u.email === email);
    if (user) {
      console.log(`Found user: ${user.id}. Confirming email...`);
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { email_confirm: true }
      );
      if (updateError) throw updateError;
      console.log('User email confirmed successfully!');
    } else {
      console.log('User not found. Creating auto-confirmed user...');
      const { error: createError } = await supabase.auth.admin.createUser({
        email,
        password: 'demopassword',
        email_confirm: true
      });
      if (createError) throw createError;
      console.log('User created and confirmed successfully!');
    }
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

main();
