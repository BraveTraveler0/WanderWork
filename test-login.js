// Test login for Darrien Carter
const testLogin = async () => {
  try {
    const response = await fetch('http://localhost:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'darrienccarter@gmail.com',
        password: 'password123'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Login failed:', data.message);
      return;
    }

    console.log('✅ Login successful!');
    console.log('User:', data.user.firstName, data.user.lastName);
    console.log('Email:', data.user.email);
    console.log('Credits:', data.user.creditsBalance);
    console.log('Token:', data.token.substring(0, 20) + '...');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testLogin();
