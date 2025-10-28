$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ================= CONFIG =================
$base = "http://localhost:8000/api"
$apiKey = ""  # Optional if you already set $idToken
$email = "rmohammed13.m@gmail.com"
$password = "Password6565"
$idToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjdlYTA5ZDA1NzI2MmU2M2U2MmZmNzNmMDNlMDRhZDI5ZDg5Zjg5MmEiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiUmF5aGFuIE1vaGFtbWVkIiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL2F0cy1jYW5kaWRhdGUtc3lzdGVtIiwiYXVkIjoiYXRzLWNhbmRpZGF0ZS1zeXN0ZW0iLCJhdXRoX3RpbWUiOjE3NjE2MDQwMzMsInVzZXJfaWQiOiJCUE9aY2ZPckFxaGNTWThzR1A2YUZ1RkVNNXAxIiwic3ViIjoiQlBPWmNmT3JBcWhjU1k4c0dQNmFGdUZFTTVwMSIsImlhdCI6MTc2MTYwNDAzMywiZXhwIjoxNzYxNjA3NjMzLCJlbWFpbCI6InJtb2hhbW1lZDEzLm1AZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsicm1vaGFtbWVkMTMubUBnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.lfVEAjJ958RYPJcTR-lQcOW-v1UlNR5XB1wYnmfKITKXO435mGXN6kcQ8MmCRn0dvot6qiAsIiDGuiwk58CRrgfLVIpoxXChDhLI0pPbU4-1wlxjxTJe2qupUzQWdwsez3yDq5dXhryrpaMFQokKN-mpQv8NxqFiXODD6z7Vv0X1N2KIeP6o8GGS3pkCFpPA-g-t38bYEQd1dB1TWq5CSnpQVWveiS7HyWIRfPMc3PJMUybtuSXGMwvHPubctq6a5KgZvemCVR-cHeaqXMfnWPaobu8CEEnFt2SSlJzMV4cHuyR9shbcgmrksi5e9wbuGCE8DdNrppGbiyoi344aAQ"
$doRegister = $false
$doDelete = $false
# ==========================================


# ========== Helper Functions ==============
function Get-IdToken {
    param([string]$Email, [string]$Password, [string]$ApiKey)
    $body = @{ email = $Email; password = $Password; returnSecureToken = $true } | ConvertTo-Json
    $url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=$ApiKey"
    try {
        $resp = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $body
        return $resp.idToken
    } catch {
        Write-Host "Sign-in failed:" $_.Exception.Message -ForegroundColor Red
        if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
        return $null
    }
}

function Print-Step($msg) {
    Write-Host "`n=== $msg ===" -ForegroundColor Cyan
}
# ==========================================


# =========== Registration (Optional) ============
try {
    if ($doRegister) {
        Print-Step "Auth: POST /auth/register"
        $regBody = @{
            email = $email
            password = $password
            confirm_password = $password
            first_name = "Rayhan"
            last_name = "Mohammed"
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$base/auth/register" -Method Post -ContentType "application/json" -Body $regBody
    }
} catch {
    Write-Host "Register failed:" $_.Exception.Message -ForegroundColor Yellow
    if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
}

# =========== Auth Token Handling ============
if (-not $idToken) {
    if ($apiKey -and $email -and $password) {
        $idToken = Get-IdToken -Email $email -Password $password -ApiKey $apiKey
    }
}
if (-not $idToken) {
    Write-Host "No ID token available; set `$idToken or enable sign-in." -ForegroundColor Yellow
    return
}

$headers = @{ Authorization = "Bearer $idToken" }
$verifyBody = @{ id_token = $idToken } | ConvertTo-Json
Invoke-RestMethod -Uri "$base/auth/verify-token" -Method Post -ContentType "application/json" -Body $verifyBody


# =========== USERS ============
try {
    Print-Step "User: GET /users/me"
    $me = Invoke-RestMethod -Uri "$base/users/me" -Headers $headers -Method Get
    $me
} catch {
    Write-Host "GET /users/me failed:" $_.Exception.Message -ForegroundColor Red
}

try {
    Print-Step "User: PUT /users/me"
    $profilePut = @{
        first_name = "Ada"
        last_name = "Lovelace"
        phone = "+15551234567"
        city = "New York"
        state = "NY"
        headline = "Software Engineer"
        summary = "Building things."
        industry = "Technology"
        experience_level = "senior"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$base/users/me" -Headers $headers -Method Put -ContentType "application/json" -Body $profilePut
} catch {
    Write-Host "PUT /users/me failed:" $_.Exception.Message -ForegroundColor Yellow
}


# =========== EMPLOYMENT ============
try {
    Print-Step "Employment: GET list"
    $empList = Invoke-RestMethod -Uri "$base/profile/employment" -Headers $headers -Method Get
    $empList
} catch {
    Write-Host "GET employment failed:" $_.Exception.Message -ForegroundColor Yellow
}

$empId = $null
try {
    Print-Step "Employment: POST create"
    $empCreate = @{
        company_name = "Acme Corp"
        job_title = "Engineer"
        location = "NY"
        start_date = "2023-01-01"
        is_current = $true
        description = "Built stuff"
        achievements = @("Did X", "Did Y")
    } | ConvertTo-Json -Depth 5
    $empResp = Invoke-RestMethod -Uri "$base/profile/employment" -Headers $headers -Method Post -ContentType "application/json" -Body $empCreate
    $empId = $empResp.work_experience.id
} catch {
    Write-Host "POST employment failed:" $_.Exception.Message -ForegroundColor Yellow
}

if ($empId) {
    try {
        Print-Step "Employment: PATCH update"
        $empPatch = @{ description = "Updated description" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$base/profile/employment/$empId" -Headers $headers -Method Patch -ContentType "application/json" -Body $empPatch
    } catch {
        Write-Host "PATCH employment failed:" $_.Exception.Message -ForegroundColor Yellow
    }
}


# =========== SKILLS ============
try {
    Print-Step "Skills: GET list ==="
    $skillsList = Invoke-RestMethod -Uri "$base/profile/skills" -Headers $headers -Method Get
    $skillsList | ConvertTo-Json -Depth 5
} catch {
    Write-Host "GET skills failed:" $_.Exception.Message -ForegroundColor Yellow
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { 
        Write-Host $_.ErrorDetails.Message 
    }
}

$skillId = $null
try {
    Print-Step "Skills: POST create ==="
    $unique = Get-Random
    $skillCreate = @{ name = "Python-$unique"; level = "advanced"; years = 3 } | ConvertTo-Json
    $skillResp = Invoke-RestMethod -Uri "$base/profile/skills" -Headers $headers -Method Post -ContentType "application/json" -Body $skillCreate
    $skillResp | ConvertTo-Json -Depth 5
    $skillId = $skillResp.id
} catch {
    Write-Host "POST skills failed:" $_.Exception.Message -ForegroundColor Yellow
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { 
        Write-Host $_.ErrorDetails.Message 
    }
}

if ($skillId) {
    try {
        Print-Step "Skills: PATCH update ==="
        $skillPatch = @{ level = "expert" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$base/profile/skills/$skillId" -Headers $headers -Method Patch -ContentType "application/json" -Body $skillPatch
    } catch {
        Write-Host "PATCH skills failed:" $_.Exception.Message -ForegroundColor Yellow
        if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
            Write-Host $_.ErrorDetails.Message
        }
        elseif ($_.Exception.Response) {
            $reader = New-Object IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host ($reader.ReadToEnd())
        }
    }
}

# =========== EDUCATION ============
try {
    Print-Step "Education: GET list"
    Invoke-RestMethod -Uri "$base/profile/education" -Headers $headers -Method Get
} catch {
    Write-Host "GET education failed:" $_.Exception.Message -ForegroundColor Yellow
}

$eduId = $null
try {
Print-Step "Education: POST create ==="
    $eduCreate = @{
    institution = "NJIT"
    degree_type = "ba"
    field_of_study = "Computer Science"
    start_date = "2022-09-01"
    graduation_date = "2026-05-15" # mapped to end_date
    gpa = 4.0
    currently_enrolled = $false
    } | ConvertTo-Json
    $eduResp = Invoke-RestMethod -Uri "$base/profile/education" -Headers $headers -Method Post -ContentType "application/json" -Body $eduCreate
    $eduResp | ConvertTo-Json -Depth 5
    } catch {
Write-Host "POST education failed:" $_.Exception.Message -ForegroundColor Yellow
if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
}

if ($eduId) {
    try {
        Print-Step "Education: PATCH update"
        $eduPatch = @{ honors = "Summa Cum Laude" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$base/profile/education/$eduId" -Headers $headers -Method Patch -ContentType "application/json" -Body $eduPatch
    } catch {
        Write-Host "PATCH education failed:" $_.Exception.Message -ForegroundColor Yellow
    }
}


# =========== PROJECTS ============
try {
    Print-Step "Projects: GET list"
    Invoke-RestMethod -Uri "$base/profile/projects" -Headers $headers -Method Get
} catch {
    Write-Host "GET projects failed:" $_.Exception.Message -ForegroundColor Yellow
}

$projId = $null
try {
    Print-Step "Projects: POST create ==="
    $projCreate = @{
    name = "ATS App" # not 'title'
    description = "Built an ATS"
    role = "Developer"
    start_date = "2024-09-01"
    end_date = "2024-10-01"
    project_url = "https://example.com" # not 'url'
    team_size = 3
    collaboration_details = "Worked with a small team"
    outcomes = "Delivered MVP"
    industry = "Technology"
    category = "Portfolio"
    status = "completed" # completed|ongoing|planned
    technologies = @("React","Django","Postgres")
    } | ConvertTo-Json
    $projResp = Invoke-RestMethod -Uri "$base/profile/projects" -Headers $headers -Method Post -ContentType "application/json" -Body $projCreate
    $projResp | ConvertTo-Json -Depth 5
    } catch {
    Write-Host "POST projects failed:" $_.Exception.Message -ForegroundColor Yellow
    if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
    }

if ($projId) {
    try {
        Print-Step "Projects: PATCH update"
        $projPatch = @{ description = "Updated details" } | ConvertTo-Json
        Invoke-RestMethod -Uri "$base/profile/projects/$projId" -Headers $headers -Method Patch -ContentType "application/json" -Body $projPatch
    } catch {
        Write-Host "PATCH projects failed:" $_.Exception.Message -ForegroundColor Yellow
    }
}


# =========== LOGOUT ============
try {
    Print-Step "Auth: POST /auth/logout"
    Invoke-RestMethod -Uri "$base/auth/logout" -Headers $headers -Method Post
} catch {
    Write-Host "Logout failed:" $_.Exception.Message -ForegroundColor Yellow
}
