const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://gkvoluaetwaqmnpocqee.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrdm9sdWFldHdhcW1ucG9jcWVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzQ1OTc3OSwiZXhwIjoyMDk5MDM1Nzc5fQ.nc758KNro9f9whYuPe0S1wwi5TFQplQl3nJINS5-9DY';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const attendanceData = [
  { name: 'Aaradhya', status: 'present', time: '17:34' },
  { name: 'Adhira', status: 'present', time: '17:48' },
  { name: 'Adhiraj', status: 'present', time: '17:34' },
  { name: 'Akshita', status: 'present', time: '17:34' },
  { name: 'Alisha', status: 'present', time: '17:13' },
  { name: 'Anshita', status: 'absent', time: null },
  { name: 'Arnav', status: 'present', time: '17:34' },
  { name: 'Dhruv', status: 'present', time: '17:37' },
  { name: 'Kavyansh', status: 'absent', time: null },
  { name: 'Ritul', status: 'absent', time: null },
  { name: 'Virat', status: 'present', time: '17:13' }
];

async function main() {
  console.log('Seeding attendance data for July 4th...');
  try {
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;
    const user = users.find(u => u.email === 'kushaldemo123@gmail.com');
    if (!user) {
      console.error('Demo user not found.');
      return;
    }

    let batch;
    const { data: batches, error: batchError } = await supabase
      .from('batches')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);
    if (batchError) throw batchError;

    // We want the Sat 5:30 batch specifically if it exists, or update the existing one
    const satBatch = batches.find(b => b.name.includes('5:30') || b.schedule?.includes('5:30'));
    if (satBatch) {
      batch = satBatch;
      console.log(`Using existing Saturday 5:30 batch: ${batch.name}`);
    } else if (batches.length > 0) {
      batch = batches[0];
      // Update batch name/schedule to match Sat 5:30
      await supabase.from('batches').update({ name: 'SIP Sat 5:30 Batch', schedule: 'Saturday 5:30 PM' }).eq('id', batch.id);
      batch.name = 'SIP Sat 5:30 Batch';
      batch.schedule = 'Saturday 5:30 PM';
      console.log(`Updated existing batch to Saturday 5:30: ${batch.name}`);
    } else {
      console.log('Creating a new Saturday 5:30 batch...');
      const { data: newBatch, error: createBatchError } = await supabase
        .from('batches')
        .insert({
          name: 'SIP Sat 5:30 Batch',
          schedule: 'Saturday 5:30 PM',
          user_id: user.id,
          is_active: true
        })
        .select()
        .single();
      if (createBatchError) throw createBatchError;
      batch = newBatch;
      console.log(`Created batch: ${batch.name}`);
    }

    console.log('Ensuring all students exist in this batch...');
    const studentsList = [];
    for (const item of attendanceData) {
      const { data: existing, error: findError } = await supabase
        .from('students')
        .select('*')
        .eq('batch_id', batch.id)
        .eq('name', item.name)
        .eq('is_active', true);
      if (findError) throw findError;

      let student;
      if (existing.length > 0) {
        student = existing[0];
        console.log(`Student ${item.name} already exists.`);
      } else {
        const { data: newStudent, error: addError } = await supabase
          .from('students')
          .insert({
            batch_id: batch.id,
            name: item.name,
            is_active: true,
            enrollment_date: '2026-07-01'
          })
          .select()
          .single();
        if (addError) throw addError;
        student = newStudent;
        console.log(`Added student: ${item.name}`);
      }
      studentsList.push({ student, status: item.status, time: item.time });
    }

    console.log('Inserting attendance records for 2026-07-04...');
    const date = '2026-07-04';
    const attendanceInserts = studentsList.map(item => ({
      student_id: item.student.id,
      batch_id: batch.id,
      date,
      status: item.status,
      arrival_time: item.time
    }));

    const { error: attError } = await supabase
      .from('attendance')
      .upsert(attendanceInserts, { onConflict: 'student_id,batch_id,date' });

    if (attError) {
      console.error('Failed to upsert attendance. Ensure SQL update v2 was run.');
      throw attError;
    }

    console.log('Successfully seeded all attendance records for 2026-07-04!');
  } catch (err) {
    console.error('Seeding failed:', err);
  }
}

main();
