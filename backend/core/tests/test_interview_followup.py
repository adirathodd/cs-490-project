from django.test import TestCase
from unittest.mock import patch, MagicMock
from core import interview_followup
import json

class InterviewFollowUpTests(TestCase):
    @patch('core.resume_ai.call_gemini_api')
    def test_run_followup_generation_success(self, mock_call_gemini):
        # Mock response
        mock_response = {
            "templates": [
                {
                    "type": "thank_you",
                    "subject": "Thank you",
                    "body": "Body content",
                    "timing_suggestion": "Send now",
                    "personalization_notes": "Notes"
                }
            ]
        }
        mock_call_gemini.return_value = json.dumps(mock_response)
        
        details = {
            "role": "Dev",
            "company": "Acme",
            "interviewer_name": "Alice"
        }
        
        result = interview_followup.run_followup_generation(
            interview_details=details,
            followup_type='thank_you',
            api_key='fake_key'
        )
        
        self.assertEqual(result['templates'][0]['subject'], "Thank you")
        self.assertTrue('generated_at' in result)
        
    @patch('core.resume_ai.call_gemini_api')
    def test_run_followup_generation_fallback(self, mock_call_gemini):
        # Mock failure
        mock_call_gemini.side_effect = Exception("API Error")
        
        details = {
            "role": "Dev",
            "company": "Acme",
            "interviewer_name": "Alice",
            "candidate_name": "Bob"
        }
        
        result = interview_followup.run_followup_generation(
            interview_details=details,
            followup_type='thank_you',
            api_key='fake_key'
        )
        
        # Should return fallback
        self.assertIn("Thank you", result['templates'][0]['subject'])
        self.assertIn("Bob", result['templates'][0]['body'])
        self.assertIn("fallback", result['templates'][0]['personalization_notes'])

    def test_build_followup_prompt(self):
        details = {"role": "Dev"}
        prompt = interview_followup.build_followup_prompt(details, "thank_you", "professional")
        self.assertIn("Dev", prompt)
        self.assertIn("thank_you", prompt)
