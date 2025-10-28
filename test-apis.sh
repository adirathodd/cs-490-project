#!/usr/bin/env bash

# Lightweight API test script (bash port of test-apis.ps1)
# macOS/bash friendly, no external deps required (uses Python stdlib for JSON parsing)
# Fill in apiKey/email/password OR supply idToken directly.

# ================= CONFIG =================
base="http://localhost:8000/api"
apiKey=""      # Optional if you already set idToken
email=""       # e.g., user@example.com
password=""   # e.g., supersecret
idToken=""     # You can paste a token from the frontend: window.auth.currentUser.getIdToken().then(t=>console.log(t))

doRegister=false
doDelete=false  # Reserved for future use
# ==========================================

# ========== Helpers ==============
print_step() {
  # Cyan header
  printf "\n\033[36m=== %s ===\033[0m\n" "$1"
}

# json_get: extract a dotted path from JSON using Python (jq-less)
# Usage: echo "$json" | json_get '.work_experience.id'
json_get() {
  python3 - "$@" <<'PY'
import sys, json
path = sys.argv[1] if len(sys.argv) > 1 else ''
path = path.lstrip('.')
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(1)
if not path:
    print('')
    sys.exit(0)
cur = data
for part in path.split('.'):
    if isinstance(cur, list) and part.isdigit():
        idx = int(part)
        if 0 <= idx < len(cur):
            cur = cur[idx]
        else:
            cur = None
            break
    elif isinstance(cur, dict):
        cur = cur.get(part)
    else:
        cur = None
        break
if cur is None:
    print('')
elif isinstance(cur, (str, int, float)):
    print(cur)
else:
    print(json.dumps(cur))
PY
}

# curl_json: perform JSON request, capture body and status code
# Sets global LAST_HTTP_CODE and prints body to stdout on success; on failure prints error details and returns 1
curl_json() {
  local method="$1" url="$2" data="${3:-}" token="${4:-}"
  local tmp="$(mktemp)"
  local http
  local -a args=( -sS -o "$tmp" -w "%{http_code}" -X "$method" -H "Content-Type: application/json" )
  if [[ -n "$token" ]]; then args+=( -H "Authorization: Bearer $token" ); fi
  if [[ -n "$data" ]]; then args+=( --data "$data" ); fi

  http=$(curl "${args[@]}" "$url") || http=$?
  local body
  body=$(cat "$tmp")
  rm -f "$tmp"
  LAST_HTTP_CODE="$http"

  # If curl failed at transport level, http will be a non-integer; treat as error
  if ! [[ "$http" =~ ^[0-9]{3}$ ]]; then
    echo "Request failed (transport): $http" >&2
    echo "$body" >&2
    return 1
  fi
  if (( http >= 200 && http < 300 )); then
    printf "%s" "$body"
    return 0
  else
    echo "HTTP $http Error: $url" >&2
    [[ -n "$body" ]] && echo "$body" >&2
    return 1
  fi
}

# negative_test: run a request expected to FAIL with specific HTTP codes
# Usage: negative_test "Label" METHOD "/path" "$json" "$token_or_empty" 400 401
negative_test() {
  local label="$1" method="$2" path="$3" data="${4:-}" token="${5:-}"
  shift 5
  local expected=("$@")
  print_step "$label"
  local tmp
  tmp="$(mktemp)"
  local -a args=( -sS -o "$tmp" -w "%{http_code}" -X "$method" -H "Content-Type: application/json" )
  if [[ -n "$token" ]]; then args+=( -H "Authorization: Bearer $token" ); fi
  if [[ -n "$data" ]]; then args+=( --data "$data" ); fi
  local code body url
  url="$base$path"
  code=$(curl "${args[@]}" "$url")
  body=$(cat "$tmp"); rm -f "$tmp"

  local ok=1 ec
  for ec in "${expected[@]}"; do
    if [[ "$code" == "$ec" ]]; then ok=0; break; fi
  done
  if (( ok == 0 )); then
    printf "\033[32mPASS\033[0m %s -> expected [%s], got %s\n" "$path" "${expected[*]}" "$code"
  else
    printf "\033[31mFAIL\033[0m %s -> expected [%s], got %s\n" "$path" "${expected[*]}" "$code"
  fi
  if [[ -n "$body" ]]; then
    echo "$body"
  fi
}

# Get ID token via Google Identity Toolkit (email/password)
get_id_token() {
  local email="$1" password="$2" apikey="$3"
  local url="https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$apikey"
  local payload
  payload=$(cat <<JSON
{
  "email": "$email",
  "password": "$password",
  "returnSecureToken": true
}
JSON
)
  local resp
  if ! resp=$(curl_json POST "$url" "$payload"); then
    echo "Sign-in failed" >&2
    return 1
  fi
  echo "$resp" | json_get '.idToken'
}
# =================================

# =========== Registration (Optional) ============
if [[ "$doRegister" == "true" ]]; then
  print_step "Auth: POST /auth/register"
  regBody=$(cat <<JSON
{
  "email": "$email",
  "password": "$password",
  "confirm_password": "$password",
  "first_name": "Rayhan",
  "last_name": "Mohammed"
}
JSON
)
  curl_json POST "$base/auth/register" "$regBody" >/dev/null || true
fi

# =========== Auth Token Handling ============
if [[ -z "$idToken" ]]; then
  if [[ -n "$apiKey" && -n "$email" && -n "$password" ]]; then
    print_step "Auth: Fetching ID token"
    if ! idToken="$(get_id_token "$email" "$password" "$apiKey")"; then
      echo "Unable to obtain idToken. Set idToken or provide valid apiKey/email/password." >&2
      exit 1
    fi
  fi
fi
if [[ -z "$idToken" ]]; then
  echo "No ID token available; set idToken or enable sign-in." >&2
  exit 0
fi

# Verify token with backend
verifyBody=$(cat <<JSON
{ "id_token": "$idToken" }
JSON
)
curl_json POST "$base/auth/verify-token" "$verifyBody" >/dev/null || true

# Common header is via token in curl_json fourth arg

# =========== USERS ============
print_step "User: GET /users/me"
curl_json GET "$base/users/me" "" "$idToken" || true

print_step "User: PUT /users/me"
profilePut=$(cat <<'JSON'
{
  "first_name": "Ada",
  "last_name": "Lovelace",
  "phone": "+15551234567",
  "city": "New York",
  "state": "NY",
  "headline": "Software Engineer",
  "summary": "Building things.",
  "industry": "Technology",
  "experience_level": "senior"
}
JSON
)
curl_json PUT "$base/users/me" "$profilePut" "$idToken" >/dev/null || true

# =========== EMPLOYMENT ============
print_step "Employment: GET list"
curl_json GET "$base/profile/employment" "" "$idToken" || true

print_step "Employment: POST create"
empCreate=$(cat <<'JSON'
{
  "company_name": "Acme Corp",
  "job_title": "Engineer",
  "location": "NY",
  "start_date": "2023-01-01",
  "is_current": true,
  "description": "Built stuff",
  "achievements": ["Did X", "Did Y"]
}
JSON
)
empResp=$(curl_json POST "$base/profile/employment" "$empCreate" "$idToken" || true)
empId="$(echo "$empResp" | json_get '.work_experience.id')"

if [[ -n "$empId" ]]; then
  print_step "Employment: PATCH update"
  empPatch='{"description":"Updated description"}'
  curl_json PATCH "$base/profile/employment/$empId" "$empPatch" "$idToken" >/dev/null || true
fi

# =========== SKILLS ============
print_step "Skills: GET list"
curl_json GET "$base/profile/skills" "" "$idToken" || true

print_step "Skills: POST create"
unique=$RANDOM
skillCreate=$(cat <<JSON
{ "name": "Python-$unique", "level": "advanced", "years": 3 }
JSON
)
skillResp=$(curl_json POST "$base/profile/skills" "$skillCreate" "$idToken" || true)
skillId="$(echo "$skillResp" | json_get '.id')"

if [[ -n "$skillId" ]]; then
  print_step "Skills: PATCH update"
  skillPatch='{"level":"expert"}'
  curl_json PATCH "$base/profile/skills/$skillId" "$skillPatch" "$idToken" >/dev/null || true
fi

# =========== EDUCATION ============
print_step "Education: GET list"
curl_json GET "$base/profile/education" "" "$idToken" || true

print_step "Education: POST create"
eduCreate=$(cat <<'JSON'
{
  "institution": "NJIT",
  "degree_type": "ba",
  "field_of_study": "Computer Science",
  "start_date": "2022-09-01",
  "graduation_date": "2026-05-15",
  "gpa": 4.0,
  "currently_enrolled": false
}
JSON
)
eduResp=$(curl_json POST "$base/profile/education" "$eduCreate" "$idToken" || true)
eduId="$(echo "$eduResp" | json_get '.id')"

if [[ -n "$eduId" ]]; then
  print_step "Education: PATCH update"
  eduPatch='{"honors":"Summa Cum Laude"}'
  curl_json PATCH "$base/profile/education/$eduId" "$eduPatch" "$idToken" >/dev/null || true
fi

# =========== PROJECTS ============
print_step "Projects: GET list"
curl_json GET "$base/profile/projects" "" "$idToken" || true

print_step "Projects: POST create"
projCreate=$(cat <<'JSON'
{
  "name": "ATS App",
  "description": "Built an ATS",
  "role": "Developer",
  "start_date": "2024-09-01",
  "end_date": "2024-10-01",
  "project_url": "https://example.com",
  "team_size": 3,
  "collaboration_details": "Worked with a small team",
  "outcomes": "Delivered MVP",
  "industry": "Technology",
  "category": "Portfolio",
  "status": "completed",
  "technologies": ["React","Django","Postgres"]
}
JSON
)
projResp=$(curl_json POST "$base/profile/projects" "$projCreate" "$idToken" || true)
projId="$(echo "$projResp" | json_get '.id')"

if [[ -n "$projId" ]]; then
  print_step "Projects: PATCH update"
  projPatch='{"description":"Updated details"}'
  curl_json PATCH "$base/profile/projects/$projId" "$projPatch" "$idToken" >/dev/null || true
fi

# =========== NEGATIVE TESTS (expected failures) ============
print_step "Negative tests"

# Invalid token verification (expect 400 or 401)
badVerify='{"id_token":"invalid"}'
negative_test "NEG: verify-token with invalid token" POST "/auth/verify-token" "$badVerify" "" 400 401

# Unauthorized access without token (expect 401)
negative_test "NEG: GET /users/me without token" GET "/users/me" "" "" 401

# Invalid profile update: bad phone format (expect 400)
badProfile='{"phone":"not-a-phone"}'
negative_test "NEG: PUT /users/me invalid phone" PUT "/users/me" "$badProfile" "$idToken" 400

# Employment: missing required fields (expect 400)
badEmp1='{"company_name":"Acme","is_current":false,"start_date":"2024-01-01"}'
negative_test "NEG: POST /profile/employment missing fields" POST "/profile/employment" "$badEmp1" "$idToken" 400

# Employment: start_date after end_date (expect 400)
badEmp2='{"company_name":"Acme","job_title":"Engineer","is_current":false,"start_date":"2024-02-01","end_date":"2024-01-01"}'
negative_test "NEG: POST /profile/employment invalid date order" POST "/profile/employment" "$badEmp2" "$idToken" 400

# Skills: invalid level (expect 400)
badSkill1='{"name":"BadSkill","level":"ninja","years":1}'
negative_test "NEG: POST /profile/skills invalid level" POST "/profile/skills" "$badSkill1" "$idToken" 400

# Skills: missing name and skill_id (expect 400)
badSkill2='{"level":"beginner","years":1}'
negative_test "NEG: POST /profile/skills missing identifiers" POST "/profile/skills" "$badSkill2" "$idToken" 400

# Education: GPA out of range (expect 400)
badEdu1='{"institution":"NJIT","degree_type":"ba","start_date":"2022-01-01","graduation_date":"2022-05-01","gpa":4.5}'
negative_test "NEG: POST /profile/education GPA out of range" POST "/profile/education" "$badEdu1" "$idToken" 400

# Education: start after graduation (expect 400)
badEdu2='{"institution":"NJIT","degree_type":"ba","start_date":"2025-01-01","graduation_date":"2024-01-01"}'
negative_test "NEG: POST /profile/education invalid dates" POST "/profile/education" "$badEdu2" "$idToken" 400

# Projects: invalid status choice (expect 400)
badProj1='{"name":"Bad","status":"invalid"}'
negative_test "NEG: POST /profile/projects invalid status" POST "/profile/projects" "$badProj1" "$idToken" 400

# Projects: non-positive team size (expect 400)
badProj2='{"name":"Bad2","status":"completed","team_size":0}'
negative_test "NEG: POST /profile/projects non-positive team size" POST "/profile/projects" "$badProj2" "$idToken" 400

# =========== LOGOUT ============
print_step "Auth: POST /auth/logout"
curl_json POST "$base/auth/logout" "" "$idToken" >/dev/null || true

# Logout without token (expect 401)
negative_test "NEG: POST /auth/logout without token" POST "/auth/logout" "" "" 401

print_step "Done"
