@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_application_package(request, job_id):
    """
    UC-069: Generate Application Package
    
    POST: Generate a comprehensive application package for a specific job
    """
    try:
        from core.automation import generate_application_package as auto_generate_package
        from core.models import JobEntry, CandidateProfile
        
        # Get the job and candidate
        job = JobEntry.objects.get(id=job_id)
        profile = CandidateProfile.objects.get(user=request.user)
        
        # Get parameters from request
        parameters = request.data or {}
        
        # Generate the application package using the automation engine
        package = auto_generate_package(
            job_id=job_id, 
            candidate_id=profile.id,
            parameters=parameters
        )
        
        # Serialize the response
        response_data = {
            "package_id": package.id,
            "job": {
                "id": job.id,
                "title": job.position_name,
                "company": job.company_name
            },
            "generated_documents": [],
            "status": package.status,
            "created_at": package.created_at.isoformat() if package.created_at else None
        }
        
        # Add document info if available
        if package.resume_document:
            response_data["generated_documents"].append({
                "type": "resume",
                "document_id": package.resume_document.id,
                "ai_generated": True,
                "customized_for_job": True
            })
        
        if package.cover_letter_document:
            response_data["generated_documents"].append({
                "type": "cover_letter", 
                "document_id": package.cover_letter_document.id,
                "ai_generated": True,
                "customized_for_job": True
            })
        
        logger.info(f"Generated application package {package.id} for job {job_id}")
        
        return Response(response_data, status=status.HTTP_201_CREATED)
        
    except JobEntry.DoesNotExist:
        return Response(
            {
                'error': {
                    'code': 'job_not_found',
                    'message': f'Job with ID {job_id} not found'
                }
            },
            status=status.HTTP_404_NOT_FOUND
        )
    except CandidateProfile.DoesNotExist:
        return Response(
            {
                'error': {
                    'code': 'profile_not_found',
                    'message': 'User profile not found'
                }
            },
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error generating application package: {e}")
        return Response(
            {
                'error': {
                    'code': 'generation_failed',
                    'message': f'Failed to generate application package: {str(e)}'
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
