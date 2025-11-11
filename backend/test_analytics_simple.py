from django.test import Client
from django.contrib.auth.models import User
import json

print("Testing analytics endpoint...")

# Create a test client
client = Client()

try:
    # Try to access the endpoint without authentication (should fail)
    response = client.get('/api/jobs/analytics')
    print(f"Without auth - Status: {response.status_code}")
    print(f"Response: {response.content.decode()}")
    
    # Create a test user and authenticate
    user = User.objects.create_user(username='testuser', password='testpass')
    client.force_login(user)
    
    # Try with authentication
    response = client.get('/api/jobs/analytics')
    print(f"\nWith auth - Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"Success! Response keys: {list(data.keys())}")
        
        if 'cover_letter_performance' in data:
            cl_data = data['cover_letter_performance']
            print(f"Cover letter performance keys: {list(cl_data.keys())}")
            
            if 'tone_performance' in cl_data:
                print(f"Tone performance: {cl_data['tone_performance']}")
    else:
        print(f"Error response: {response.content.decode()}")
        
    # Clean up
    user.delete()
    
except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()