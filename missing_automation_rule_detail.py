
@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def automation_rule_detail(request, rule_id):
    """
    UC-069: Retrieve, update, or delete a specific automation rule
    """
    try:
        profile = CandidateProfile.objects.get(user=request.user)
        from core.models import ApplicationAutomationRule
        
        try:
            rule = ApplicationAutomationRule.objects.get(id=rule_id, candidate=profile)
        except ApplicationAutomationRule.DoesNotExist:
            return Response({'error': 'Rule not found'}, status=status.HTTP_404_NOT_FOUND)
        
        if request.method == 'GET':
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
                'last_triggered_at': rule.last_triggered_at.isoformat() if rule.last_triggered_at else None,
                'trigger_count': rule.trigger_count
            })
        
        elif request.method == 'PUT':
            # Update rule
            rule_data = request.data
            
            rule.name = rule_data.get('name', rule.name)
            rule.description = rule_data.get('description', rule.description)
            rule.trigger_type = rule_data.get('trigger_type', rule.trigger_type)
            rule.trigger_conditions = rule_data.get('trigger_conditions', rule.trigger_conditions)
            rule.action_type = rule_data.get('action_type', rule.action_type)
            rule.action_parameters = rule_data.get('action_parameters', rule.action_parameters)
            rule.is_active = rule_data.get('is_active', rule.is_active)
            
            rule.save()
            
            return Response({
                'id': rule.id,
                'name': rule.name,
                'description': rule.description,
                'trigger_type': rule.trigger_type,
                'trigger_conditions': rule.trigger_conditions,
                'action_type': rule.action_type,
                'action_parameters': rule.action_parameters,
                'is_active': rule.is_active,
                'updated_at': rule.updated_at.isoformat(),
                'trigger_count': rule.trigger_count
            })
        
        elif request.method == 'DELETE':
            rule.delete()
            return Response({'message': 'Rule deleted successfully'}, status=status.HTTP_204_NO_CONTENT)
    
    except CandidateProfile.DoesNotExist:
        return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in automation_rule_detail: {e}\n{traceback.format_exc()}")
        return Response(
            {'error': 'An error occurred processing the request'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )