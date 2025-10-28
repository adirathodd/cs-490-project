$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ================= CONFIG =================
$base = "http://localhost:8000/api"
$apiKey = ""  # Optional if you already set $idToken
$email = "rmohammed13.m@gmail.com"
$password = "Password100"
$idToken =  "eyJhbGciOiJSUzI1NiIsImtpZCI6IjdlYTA5ZDA1NzI2MmU2M2U2MmZmNzNmMDNlMDRhZDI5ZDg5Zjg5MmEiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiUmF5aGFuIE1vaGFtbWVkIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0xTUTN2MDlnZ25IaFJhWnBMSzFDaVhNS3Fkelp6a19MNDViN25rclNwSG45Rk12QT1zOTYtYyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9hdHMtY2FuZGlkYXRlLXN5c3RlbSIsImF1ZCI6ImF0cy1jYW5kaWRhdGUtc3lzdGVtIiwiYXV0aF90aW1lIjoxNzYxNjg3MjgyLCJ1c2VyX2lkIjoiMVI4MXJVMjBEUldGNU5rMGF0SGZZWERxY1JGMyIsInN1YiI6IjFSODFyVTIwRFJXRjVOazBhdEhmWVhEcWNSRjMiLCJpYXQiOjE3NjE2ODcyODIsImV4cCI6MTc2MTY5MDg4MiwiZW1haWwiOiJyYXloYW4ubW9oYW1tZWQxNUBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjExNzQ5OTgzMDQ1NjE5NTgzMzg4MCJdLCJlbWFpbCI6WyJyYXloYW4ubW9oYW1tZWQxNUBnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJnb29nbGUuY29tIn19.sFM-4pQ3XGybDgemm-HTRSbpbtd5z8qscfuTK0dPd1woGLFKxaFafkoAS7qLFcHRlTPMk-jHklnDVBBtVCbLOZOfzqBI5sbdjjcR81qUFW07RPsOcTpo5ob5wT1bCgUma7aBZB2W9uVXDfoi65FfEBOkBBFF0hCmCvxlJqeI885hUFK8nm9fp01RKC8JnQ1TSZJTdHggznNIgH4sfNWAUNHLIUNYn8aLM5s8YLPzfk-VE_KzcgDOa-8DFaARkgN5zH6p3Jn7GZ4Yi51QG4yUjRNm-ufacmY8MhxSXVX_JjpPhC5bvspUP4md2m35j4toy3VKM_uOaQUL-FUkSU1vmg"
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
