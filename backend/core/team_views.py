import secrets
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.models import (
    TeamAccount,
    TeamMembership,
    TeamInvitation,
    TeamCandidateAccess,
    TeamMessage,
    CandidateProfile,
    JobEntry,
    MentorshipGoal,
    MentorshipMessage,
)
from core.serializers import (
    TeamAccountSerializer,
    TeamMembershipSerializer,
    TeamInvitationSerializer,
    TeamCandidateAccessSerializer,
    TeamMessageSerializer,
    TeamDashboardSerializer,
)


def _get_membership(team_id, user):
    return (
        TeamMembership.objects.select_related('team', 'user', 'candidate_profile')
        .filter(team_id=team_id, user=user, is_active=True)
        .first()
    )


def _team_and_membership(team_id, user):
    membership = _get_membership(team_id, user)
    if not membership:
        return None, None, Response({"error": "You do not have access to this team."}, status=status.HTTP_403_FORBIDDEN)
    return membership.team, membership, None


def _require_admin(team_id, user):
    team, membership, error = _team_and_membership(team_id, user)
    if error:
        return None, None, error
    if membership.role != 'admin' and membership.permission_level != 'admin':
        return None, None, Response({"error": "Admin access required for this action."}, status=status.HTTP_403_FORBIDDEN)
    return team, membership, None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def team_accounts(request):
    """List or create team accounts for the authenticated user."""
    if request.method == "GET":
        teams = (
            TeamAccount.objects.filter(
                Q(owner=request.user)
                | Q(memberships__user=request.user, memberships__is_active=True)
            )
            .distinct()
        )
        serializer = TeamAccountSerializer(teams, many=True, context={'request': request})
        return Response({"teams": serializer.data})

    payload = request.data or {}
    name = (payload.get('name') or '').strip()
    if not name:
        return Response({"error": "Team name is required."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        team = TeamAccount.objects.create(
            name=name,
            owner=request.user,
            billing_email=(payload.get('billing_email') or request.user.email or '').strip(),
            subscription_plan=payload.get('subscription_plan') or 'starter',
            seat_limit=payload.get('seat_limit') or 5,
            subscription_status='trialing',
            trial_ends_at=timezone.now() + timedelta(days=14),
        )
        TeamMembership.objects.create(
            team=team,
            user=request.user,
            role='admin',
            permission_level='admin',
            invited_by=None,
        )
    serializer = TeamAccountSerializer(team, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def team_account_detail(request, team_id):
    """Return detail for a single team including memberships and invitations."""
    team, membership, error = _team_and_membership(team_id, request.user)
    if error:
        return error

    members = TeamMembership.objects.filter(team=team).select_related('user', 'candidate_profile')
    invites = TeamInvitation.objects.filter(team=team).order_by('-created_at')[:30]
    access_grants = TeamCandidateAccess.objects.filter(team=team).select_related(
        'candidate__user', 'granted_to__user', 'granted_to__candidate_profile'
    )

    data = {
        'team': TeamAccountSerializer(team, context={'request': request}).data,
        'members': TeamMembershipSerializer(members, many=True, context={'request': request}).data,
        'invitations': TeamInvitationSerializer(invites, many=True, context={'request': request}).data,
        'access': TeamCandidateAccessSerializer(access_grants, many=True, context={'request': request}).data,
    }
    return Response(data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def team_subscription_update(request, team_id):
    """Update billing/subscription metadata for a team."""
    team, membership, error = _require_admin(team_id, request.user)
    if error:
        return error

    payload = request.data or {}
    for field in ['subscription_plan', 'subscription_status', 'billing_email']:
        if field in payload and payload[field]:
            setattr(team, field, payload[field])
    if 'seat_limit' in payload:
        try:
            seat_limit = int(payload['seat_limit'])
            if seat_limit > 0:
                team.seat_limit = seat_limit
        except (TypeError, ValueError):
            return Response({"error": "seat_limit must be a positive integer"}, status=status.HTTP_400_BAD_REQUEST)
    if 'next_billing_date' in payload:
        team.next_billing_date = payload.get('next_billing_date') or team.next_billing_date
    team.save(update_fields=['subscription_plan', 'subscription_status', 'billing_email', 'seat_limit', 'next_billing_date', 'updated_at'])
    return Response(TeamAccountSerializer(team, context={'request': request}).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def team_invites(request, team_id):
    """List or create invitations for a team."""
    team, membership, error = _require_admin(team_id, request.user)
    if error:
        return error

    if request.method == "GET":
        invites = TeamInvitation.objects.filter(team=team).order_by('-created_at')[:50]
        serializer = TeamInvitationSerializer(invites, many=True, context={'request': request})
        return Response({'invitations': serializer.data})

    payload = request.data or {}
    email = (payload.get('email') or '').strip().lower()
    role = payload.get('role') or 'mentor'
    permission_level = payload.get('permission_level') or 'view'
    if not email:
        return Response({"error": "Email is required to send an invitation."}, status=status.HTTP_400_BAD_REQUEST)
    token = secrets.token_urlsafe(32)
    expires_at = timezone.now() + timedelta(days=7)
    candidate_profile = None
    candidate_id = payload.get('candidate_profile')
    if candidate_id:
        candidate_profile = CandidateProfile.objects.filter(id=candidate_id).first()

    invite = TeamInvitation.objects.create(
        team=team,
        email=email,
        role=role,
        permission_level=permission_level,
        token=token,
        invited_by=request.user,
        expires_at=expires_at,
        candidate_profile=candidate_profile,
    )
    serializer = TeamInvitationSerializer(invite, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def team_accept_invite(request, token):
    """Accept a pending team invitation using the invite token."""
    try:
        invite = TeamInvitation.objects.select_related('team').get(token=token)
    except TeamInvitation.DoesNotExist:
        return Response({"error": "Invitation not found."}, status=status.HTTP_404_NOT_FOUND)

    if invite.status != 'pending' or invite.is_expired():
        return Response({"error": "Invitation is no longer valid."}, status=status.HTTP_400_BAD_REQUEST)

    with transaction.atomic():
        candidate_profile = invite.candidate_profile
        if invite.role == 'candidate' and not candidate_profile:
            candidate_profile = CandidateProfile.objects.filter(user=request.user).first()
        membership, _ = TeamMembership.objects.get_or_create(
            team=invite.team,
            user=request.user,
            defaults={
                'role': invite.role,
                'permission_level': invite.permission_level,
                'invited_by': invite.invited_by,
                'candidate_profile': candidate_profile if invite.role == 'candidate' else None,
            },
        )
        update_fields = []
        if membership.permission_level != invite.permission_level:
            membership.permission_level = invite.permission_level
            update_fields.append('permission_level')
        if membership.role != invite.role:
            membership.role = invite.role
            update_fields.append('role')
        if invite.role == 'candidate' and candidate_profile and membership.candidate_profile_id != getattr(candidate_profile, 'id', None):
            membership.candidate_profile = candidate_profile
            update_fields.append('candidate_profile')
        if update_fields:
            membership.save(update_fields=update_fields)

        invite.status = 'accepted'
        invite.accepted_at = timezone.now()
        invite.accepted_by = request.user
        invite.save(update_fields=['status', 'accepted_at', 'accepted_by'])

    serializer = TeamMembershipSerializer(membership, context={'request': request})
    return Response({'membership': serializer.data, 'team': TeamAccountSerializer(invite.team, context={'request': request}).data})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def team_membership_detail(request, membership_id):
    """Update an existing membership (role/permission) or deactivate a member."""
    try:
        membership = TeamMembership.objects.select_related('team').get(id=membership_id)
    except TeamMembership.DoesNotExist:
        return Response({"error": "Membership not found."}, status=status.HTTP_404_NOT_FOUND)

    team, admin_membership, error = _require_admin(membership.team_id, request.user)
    if error:
        return error

    payload = request.data or {}
    updated = False
    if 'permission_level' in payload and payload['permission_level']:
        membership.permission_level = payload['permission_level']
        updated = True
    if 'role' in payload and payload['role']:
        membership.role = payload['role']
        updated = True
    if 'is_active' in payload:
        membership.is_active = bool(payload['is_active'])
        updated = True
    if 'candidate_profile' in payload and payload['candidate_profile']:
        candidate = CandidateProfile.objects.filter(id=payload['candidate_profile']).first()
        membership.candidate_profile = candidate
        updated = True
    if updated:
        membership.save(update_fields=['permission_level', 'role', 'is_active', 'candidate_profile', 'updated_at'] if hasattr(membership, 'updated_at') else ['permission_level', 'role', 'is_active', 'candidate_profile'])
    return Response(TeamMembershipSerializer(membership, context={'request': request}).data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def team_candidate_access(request, team_id):
    """Manage mentor access to candidate progress within a team."""
    team, membership, error = _require_admin(team_id, request.user)
    if error:
        return error

    if request.method == "GET":
        access = TeamCandidateAccess.objects.filter(team=team).select_related(
            'candidate__user', 'granted_to__user', 'granted_to__candidate_profile'
        )
        serializer = TeamCandidateAccessSerializer(access, many=True, context={'request': request})
        return Response({'access': serializer.data})

    payload = request.data or {}
    member_id = payload.get('member_id')
    candidate_id = payload.get('candidate_id')
    if not member_id or not candidate_id:
        return Response({"error": "member_id and candidate_id are required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        target_member = TeamMembership.objects.get(id=member_id, team=team, is_active=True)
    except TeamMembership.DoesNotExist:
        return Response({"error": "Target member not found for this team."}, status=status.HTTP_404_NOT_FOUND)
    try:
        candidate = CandidateProfile.objects.get(id=candidate_id)
    except CandidateProfile.DoesNotExist:
        return Response({"error": "Candidate profile not found."}, status=status.HTTP_404_NOT_FOUND)

    access_obj, _ = TeamCandidateAccess.objects.update_or_create(
        team=team,
        candidate=candidate,
        granted_to=target_member,
        defaults={
            'permission_level': payload.get('permission_level', 'view'),
            'can_view_profile': payload.get('can_view_profile', True),
            'can_view_progress': payload.get('can_view_progress', True),
            'can_edit_goals': payload.get('can_edit_goals', False),
            'granted_by': request.user,
        },
    )
    serializer = TeamCandidateAccessSerializer(access_obj, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def team_dashboard(request, team_id):
    """Aggregate pipeline + progress insights for a team."""
    team, membership, error = _team_and_membership(team_id, request.user)
    if error:
        return error

    member_counts = TeamAccountSerializer(team, context={'request': request}).data.get('member_counts', {})
    candidate_ids = list(
        TeamMembership.objects.filter(team=team, role='candidate', is_active=True, candidate_profile__isnull=False)
        .values_list('candidate_profile_id', flat=True)
    )
    if not candidate_ids:
        serializer = TeamDashboardSerializer({
            'member_counts': member_counts,
            'pipeline': {},
            'progress': {},
            'messaging': {},
            'recent_activity': [],
        })
        return Response(serializer.data)

    jobs = JobEntry.objects.filter(candidate_id__in=candidate_ids)
    pipeline = {
        'applied': jobs.filter(status='applied').count(),
        'phone_screen': jobs.filter(status='phone_screen').count(),
        'interview': jobs.filter(status='interview').count(),
        'offer': jobs.filter(status='offer').count(),
    }

    goals = MentorshipGoal.objects.filter(team_member__candidate_id__in=candidate_ids)
    progress = {
        'active_goals': goals.filter(status='active').count(),
        'completed_goals': goals.filter(status='completed').count(),
        'weekly_applications': jobs.filter(application_submitted_at__gte=timezone.now() - timedelta(days=7)).count(),
    }

    messages = TeamMessage.objects.filter(team=team)
    messaging = {
        'threads': messages.count(),
        'last_message_at': messages.first().created_at if messages else None,
    }

    recent_activity = []
    latest_jobs = jobs.order_by('-updated_at')[:5]
    for job in latest_jobs:
        recent_activity.append({
            'type': 'job',
            'title': job.title,
            'company': job.company_name,
            'status': job.status,
            'updated_at': job.updated_at,
        })
    latest_goals = goals.order_by('-created_at')[:5]
    for goal in latest_goals:
        recent_activity.append({
            'type': 'goal',
            'title': goal.title,
            'status': goal.status,
            'created_at': goal.created_at,
        })

    serializer = TeamDashboardSerializer({
        'member_counts': member_counts,
        'pipeline': pipeline,
        'progress': progress,
        'messaging': messaging,
        'recent_activity': recent_activity,
    })
    return Response(serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def team_messages(request, team_id):
    """List or create collaboration feed messages for a team."""
    team, membership, error = _team_and_membership(team_id, request.user)
    if error:
        return error

    if request.method == "GET":
        qs = TeamMessage.objects.filter(team=team).select_related('author')[:50]
        serializer = TeamMessageSerializer(qs, many=True, context={'request': request})
        return Response({'messages': serializer.data})

    if membership.permission_level == 'view':
        return Response({"error": "You need comment or edit access to post messages."}, status=status.HTTP_403_FORBIDDEN)

    payload = request.data or {}
    message = (payload.get('message') or '').strip()
    if not message:
        return Response({"error": "Message text is required."}, status=status.HTTP_400_BAD_REQUEST)

    msg = TeamMessage.objects.create(
        team=team,
        author=request.user,
        message=message,
        message_type=payload.get('message_type', 'update'),
        pinned=bool(payload.get('pinned', False)),
    )
    serializer = TeamMessageSerializer(msg, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def team_reports(request, team_id):
    """Generate coaching/performance insights for a team."""
    team, membership, error = _team_and_membership(team_id, request.user)
    if error:
        return error

    candidate_ids = list(
        TeamMembership.objects.filter(team=team, role='candidate', is_active=True, candidate_profile__isnull=False)
        .values_list('candidate_profile_id', flat=True)
    )
    jobs = JobEntry.objects.filter(candidate_id__in=candidate_ids)
    goals = MentorshipGoal.objects.filter(team_member__candidate_id__in=candidate_ids)
    mentor_messages = MentorshipMessage.objects.filter(team_member__candidate_id__in=candidate_ids)

    report = {
        'applications_per_candidate': round(jobs.count() / max(len(candidate_ids), 1), 1) if candidate_ids else 0,
        'interview_rate': round(
            (jobs.filter(status__in=['phone_screen', 'interview', 'offer']).count() / max(jobs.count(), 1)) * 100, 1
        ) if jobs.count() else 0,
        'goal_completion_rate': round(
            (goals.filter(status='completed').count() / max(goals.count(), 1)) * 100, 1
        ) if goals.exists() else 0,
        'mentor_touchpoints': mentor_messages.count(),
        'open_goals': goals.filter(status='active').count(),
        'recent_offers': jobs.filter(status='offer').count(),
    }
    return Response(report)
