

# ============================================================================
# UC-069: Application Workflow Automation Views
# ============================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def automation_rules_list_create(request):
    """
    UC-069: List automation rules or create a new rule
    
    GET: Retrieve all automation rules for the authenticated user
    POST: Create a new automation rule
    """
    try:
        profile = CandidateProfile.objects.get(user=request.user)
        
        if request.method == 'GET':
            from core.models import ApplicationAutomationRule
            rules = ApplicationAutomationRule.objects.filter(candidate=profile)
            
            # Apply filters
            is_active = request.query_params.get('is_active')
            if is_active is not None:
                rules = rules.filter(is_active=is_active.lower() == 'true')
            
            trigger_type = request.query_params.get('trigger_type')
            if trigger_type:
                rules = rules.filter(trigger_type=trigger_type)
            
            rules_data = []
            for rule in rules:
                rules_data.append({
                    'id': rule.id,
                    'name': rule.name,
                    'description': rule.description,
                    'trigger_type': rule.trigger_type,
                    'trigger_conditions': rule.trigger_conditions,
                    'action_type': rule.action_type,
                    'action_parameters': rule.action_parameters,
                    'is_active': rule.is_active,
                    'created_at': rule.created_at.isoformat(),
                    'last_triggered_at': rule.last_triggered_at.isoformat() if rule.last_triggered_at else None,
                    'trigger_count': rule.trigger_count
                })
            
            return Response({'rules': rules_data}, status=status.HTTP_200_OK)
        
        elif request.method == 'POST':
            from core.models import ApplicationAutomationRule
            
            # Create new automation rule
            rule_data = request.data
            
            rule = ApplicationAutomationRule.objects.create(
                candidate=profile,
                name=rule_data.get('name', ''),
                description=rule_data.get('description', ''),
                trigger_type=rule_data.get('trigger_type', 'job_saved'),
                trigger_conditions=rule_data.get('trigger_conditions', {}),
                action_type=rule_data.get('action_type', 'generate_documents'),
                action_parameters=rule_data.get('action_parameters', {}),
                is_active=rule_data.get('is_active', True)
            )
            
            return Response({
                'id': rule.id,
                'name': rule.name,
                'description': rule.description,
                'trigger_type': rule.trigger_type,
                'trigger_conditions': rule.trigger_conditions,
                'action_type': rule.action_type,
                'action_parameters': rule.action_parameters,
                'is_active': rule.is_active,
                'created_at': rule.created_at.isoformat(),
                'trigger_count': rule.trigger_count
            }, status=status.HTTP_201_CREATED)
    
    except CandidateProfile.DoesNotExist:
        return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in automation_rules_list_create: {e}\n{traceback.format_exc()}")
        return Response(
            {'error': 'An error occurred processing the request'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def automation_logs(request):
    """
    UC-069: Automation Execution Logs
    
    GET: Retrieve automation execution logs for monitoring and debugging
    """
    try:
        profile = CandidateProfile.objects.get(user=request.user)
        
        # Use ApplicationPackage as log source for automation activity
        from core.models import ApplicationPackage, ApplicationAutomationRule
        
        packages = ApplicationPackage.objects.filter(candidate=profile).order_by('-created_at')
        
        # Apply filters
        rule_id_filter = request.query_params.get('rule_id')
        if rule_id_filter:
            packages = packages.filter(automation_rule_id=rule_id_filter)
        
        limit = int(request.query_params.get('limit', 50))
        packages = packages[:limit]
        
        # Build response 
        logs_data = []
        for package in packages:
            logs_data.append({
                'id': package.id,
                'job_title': package.job.title,
                'company_name': package.job.company_name,
                'status': package.status,
                'generation_method': package.generation_method,
                'automation_rule_name': package.automation_rule.name if package.automation_rule else None,
                'created_at': package.created_at.isoformat(),
                'resume_doc': package.resume_document.id if package.resume_document else None,
                'cover_letter_doc': package.cover_letter_document.id if package.cover_letter_document else None,
            })
        
        return Response({
            'logs': logs_data,
            'total_count': len(logs_data)
        }, status=status.HTTP_200_OK)
    
    except CandidateProfile.DoesNotExist:
        return Response({'logs': [], 'total_count': 0}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error retrieving automation logs: {e}\n{traceback.format_exc()}")
        return Response(
            {
                'error': {
                    'code': 'internal_error',
                    'message': 'Failed to retrieve automation logs'
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def trigger_automation_rule(request, rule_id):
    """
    UC-069: Manually trigger a specific automation rule
    
    POST: Execute an automation rule manually with provided context
    """
    try:
        profile = CandidateProfile.objects.get(user=request.user)
        from core.models import ApplicationAutomationRule, JobEntry
        
        try:
            rule = ApplicationAutomationRule.objects.get(id=rule_id, candidate=profile)
        except ApplicationAutomationRule.DoesNotExist:
            return Response({'error': 'Rule not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Get job context if provided
        job_id = request.data.get('job_id')
        context_data = {}
        
        if job_id:
            try:
                job_entry = JobEntry.objects.get(id=job_id, candidate=profile)
                context_data['job_entry'] = job_entry
            except JobEntry.DoesNotExist:
                return Response({'error': 'Job not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Execute the rule
        result = rule.execute_action(context_data)
        
        if result.get('success'):
            return Response({
                'message': 'Rule executed successfully',
                'result': result
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'error': result.get('error', 'Unknown error during execution')
            }, status=status.HTTP_400_BAD_REQUEST)
    
    except CandidateProfile.DoesNotExist:
        return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error triggering automation rule: {e}\n{traceback.format_exc()}")
        return Response(
            {'error': 'An error occurred executing the rule'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def application_packages_list(request):
    """
    UC-069: List application packages
    
    GET: Retrieve all application packages for the authenticated user
    """
    try:
        profile = CandidateProfile.objects.get(user=request.user)
        from core.models import ApplicationPackage
        
        packages = ApplicationPackage.objects.filter(candidate=profile).order_by('-created_at')
        
        # Apply filters
        status_filter = request.query_params.get('status')
        if status_filter:
            packages = packages.filter(status=status_filter)
        
        job_id = request.query_params.get('job_id')
        if job_id:
            packages = packages.filter(job_id=job_id)
        
        generation_method = request.query_params.get('generation_method')
        if generation_method:
            packages = packages.filter(generation_method=generation_method)
        
        packages_data = []
        for package in packages:
            packages_data.append({
                'id': package.id,
                'job_id': package.job.id,
                'job_title': package.job.title,
                'company_name': package.job.company_name,
                'status': package.status,
                'generation_method': package.generation_method,
                'automation_rule_name': package.automation_rule.name if package.automation_rule else None,
                'document_count': package.document_count,
                'is_complete': package.is_complete,
                'created_at': package.created_at.isoformat(),
                'submitted_at': package.submitted_at.isoformat() if package.submitted_at else None,
                'resume_document_id': package.resume_document.id if package.resume_document else None,
                'cover_letter_document_id': package.cover_letter_document.id if package.cover_letter_document else None,
                'notes': package.notes
            })
        
        return Response({
            'packages': packages_data,
            'total_count': len(packages_data)
        }, status=status.HTTP_200_OK)
    
    except CandidateProfile.DoesNotExist:
        return Response({'packages': [], 'total_count': 0}, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error retrieving application packages: {e}\n{traceback.format_exc()}")
        return Response(
            {'error': 'Failed to retrieve application packages'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )