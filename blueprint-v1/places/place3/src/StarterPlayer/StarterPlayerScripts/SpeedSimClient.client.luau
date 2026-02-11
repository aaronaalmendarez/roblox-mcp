local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")
local remotes = ReplicatedStorage:WaitForChild("SpeedSimRemotes")

local stateRemote = remotes:WaitForChild("State")
local notifyRemote = remotes:WaitForChild("Notify")
local actionRemote = remotes:WaitForChild("Action")
local getStateRemote: any = remotes:WaitForChild("GetState")

local camera = workspace.CurrentCamera
local baseFov = 70

local defaultProfile = {
    speed = 0,
    steps = 0,
    gems = 0,
    wins = 0,
    rebirths = 0,
    upgrades = {
        jump = 0,
        sprint = 0,
    },
}

local defaultComputed = {
    rebirthCost = 0,
    jumpUpgradeCost = 0,
    sprintUpgradeCost = 0,
    dailyClaimRemaining = 0,
    walkSpeed = 16,
}

local defaultEvent = {
    active = false,
    title = "No Event",
    remaining = 0,
    speedMultiplier = 1,
    gemsMultiplier = 1,
}

local defaultProgression = {
    zone = {
        title = "Unknown",
        gainMultiplier = 1,
    },
    quest = {
        title = "No quest",
        target = 1,
        progress = 0,
        rewardGems = 0,
        rewardSpeed = 0,
    },
}

local function formatNumber(number)
    local n = math.floor(tonumber(number) or 0)
    local str = tostring(n)
    while true do
        local updated, count = str:gsub("^(%-?%d+)(%d%d%d)", "%1,%2")
        str = updated
        if count == 0 then
            break
        end
    end
    return str
end

local function formatDuration(seconds)
    local total = math.max(0, math.floor(tonumber(seconds) or 0))
    local h = math.floor(total / 3600)
    local m = math.floor((total % 3600) / 60)
    local s = total % 60
    if h > 0 then
        return string.format("%dh %02dm", h, m)
    end
    return string.format("%dm %02ds", m, s)
end

local screenGui = Instance.new("ScreenGui")
screenGui.Name = "SpeedSimHUD"
screenGui.ResetOnSpawn = false
screenGui.IgnoreGuiInset = false
screenGui.Parent = playerGui

local backdrop = Instance.new("Frame")
backdrop.Size = UDim2.fromScale(1, 1)
backdrop.BackgroundColor3 = Color3.fromRGB(7, 10, 16)
backdrop.BackgroundTransparency = 0.93
backdrop.Parent = screenGui

local gradient = Instance.new("UIGradient")
gradient.Color = ColorSequence.new({
    ColorSequenceKeypoint.new(0, Color3.fromRGB(18, 29, 44)),
    ColorSequenceKeypoint.new(1, Color3.fromRGB(10, 13, 21)),
})
gradient.Rotation = 24
gradient.Parent = backdrop

local function makePanel(parent, size, position, color)
    local frame = Instance.new("Frame")
    frame.Size = size
    frame.Position = position
    frame.BackgroundColor3 = color
    frame.BackgroundTransparency = 0.08
    frame.Parent = parent

    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 14)
    corner.Parent = frame

    local stroke = Instance.new("UIStroke")
    stroke.Color = Color3.fromRGB(72, 118, 255)
    stroke.Transparency = 0.48
    stroke.Thickness = 1
    stroke.Parent = frame

    local padding = Instance.new("UIPadding")
    padding.PaddingLeft = UDim.new(0, 14)
    padding.PaddingRight = UDim.new(0, 14)
    padding.PaddingTop = UDim.new(0, 12)
    padding.PaddingBottom = UDim.new(0, 12)
    padding.Parent = frame

    return frame
end

local statsFrame = makePanel(screenGui, UDim2.fromOffset(360, 290), UDim2.fromOffset(20, 20), Color3.fromRGB(20, 26, 38))
local statsLayout = Instance.new("UIListLayout")
statsLayout.Padding = UDim.new(0, 8)
statsLayout.Parent = statsFrame

local title = Instance.new("TextLabel")
title.Size = UDim2.new(1, 0, 0, 36)
title.BackgroundTransparency = 1
title.Font = Enum.Font.GothamBlack
title.TextSize = 28
title.TextXAlignment = Enum.TextXAlignment.Left
title.TextColor3 = Color3.new(1, 1, 1)
title.Text = "SPEED SIM"
title.Parent = statsFrame

local subtitle = Instance.new("TextLabel")
subtitle.Size = UDim2.new(1, 0, 0, 22)
subtitle.BackgroundTransparency = 1
subtitle.Font = Enum.Font.GothamSemibold
subtitle.TextSize = 13
subtitle.TextXAlignment = Enum.TextXAlignment.Left
subtitle.TextColor3 = Color3.fromRGB(150, 178, 226)
subtitle.Text = "Race progression, zones, quests, and rebirth loop"
subtitle.Parent = statsFrame

local function makeStatRow(name)
    local row = Instance.new("Frame")
    row.Size = UDim2.new(1, 0, 0, 26)
    row.BackgroundTransparency = 1
    row.Parent = statsFrame

    local key = Instance.new("TextLabel")
    key.Size = UDim2.new(0.52, 0, 1, 0)
    key.BackgroundTransparency = 1
    key.Font = Enum.Font.GothamSemibold
    key.TextSize = 17
    key.TextXAlignment = Enum.TextXAlignment.Left
    key.TextColor3 = Color3.fromRGB(166, 184, 214)
    key.Text = name
    key.Parent = row

    local value = Instance.new("TextLabel")
    value.Size = UDim2.new(0.48, 0, 1, 0)
    value.Position = UDim2.fromScale(0.52, 0)
    value.BackgroundTransparency = 1
    value.Font = Enum.Font.GothamBold
    value.TextSize = 18
    value.TextXAlignment = Enum.TextXAlignment.Right
    value.TextColor3 = Color3.new(1, 1, 1)
    value.Text = "0"
    value.Parent = row

    return value
end

local speedValue = makeStatRow("Speed")
local stepsValue = makeStatRow("Steps")
local gemsValue = makeStatRow("Gems")
local winsValue = makeStatRow("Wins")
local rebirthsValue = makeStatRow("Rebirths")
local zoneValue = makeStatRow("Zone")

local progressFrame = makePanel(screenGui, UDim2.fromOffset(360, 170), UDim2.fromOffset(20, 322), Color3.fromRGB(17, 23, 35))
local progressLayout = Instance.new("UIListLayout")
progressLayout.Padding = UDim.new(0, 6)
progressLayout.Parent = progressFrame

local questTitle = Instance.new("TextLabel")
questTitle.Size = UDim2.new(1, 0, 0, 28)
questTitle.BackgroundTransparency = 1
questTitle.Font = Enum.Font.GothamBold
questTitle.TextSize = 21
questTitle.TextXAlignment = Enum.TextXAlignment.Left
questTitle.TextColor3 = Color3.new(1, 1, 1)
questTitle.Text = "Quest"
questTitle.Parent = progressFrame

local questDesc = Instance.new("TextLabel")
questDesc.Size = UDim2.new(1, 0, 0, 22)
questDesc.BackgroundTransparency = 1
questDesc.Font = Enum.Font.GothamSemibold
questDesc.TextSize = 15
questDesc.TextXAlignment = Enum.TextXAlignment.Left
questDesc.TextColor3 = Color3.fromRGB(171, 194, 233)
questDesc.Text = "Loading..."
questDesc.Parent = progressFrame

local questBarBack = Instance.new("Frame")
questBarBack.Size = UDim2.new(1, 0, 0, 14)
questBarBack.BackgroundColor3 = Color3.fromRGB(30, 37, 50)
questBarBack.Parent = progressFrame

local questBarCorner = Instance.new("UICorner")
questBarCorner.CornerRadius = UDim.new(1, 0)
questBarCorner.Parent = questBarBack

local questBarFill = Instance.new("Frame")
questBarFill.Size = UDim2.fromScale(0, 1)
questBarFill.BackgroundColor3 = Color3.fromRGB(92, 182, 255)
questBarFill.Parent = questBarBack

local questFillCorner = Instance.new("UICorner")
questFillCorner.CornerRadius = UDim.new(1, 0)
questFillCorner.Parent = questBarFill

local questReward = Instance.new("TextLabel")
questReward.Size = UDim2.new(1, 0, 0, 20)
questReward.BackgroundTransparency = 1
questReward.Font = Enum.Font.GothamSemibold
questReward.TextSize = 14
questReward.TextXAlignment = Enum.TextXAlignment.Left
questReward.TextColor3 = Color3.fromRGB(136, 210, 158)
questReward.Text = ""
questReward.Parent = progressFrame

local eventFrame = makePanel(screenGui, UDim2.fromOffset(360, 78), UDim2.fromOffset(20, 500), Color3.fromRGB(18, 25, 32))
local eventLabel = Instance.new("TextLabel")
eventLabel.Size = UDim2.new(1, 0, 0, 30)
eventLabel.BackgroundTransparency = 1
eventLabel.Font = Enum.Font.GothamBold
eventLabel.TextSize = 20
eventLabel.TextXAlignment = Enum.TextXAlignment.Left
eventLabel.TextColor3 = Color3.new(1, 1, 1)
eventLabel.Text = "Event: No Event"
eventLabel.Parent = eventFrame

local eventTimer = Instance.new("TextLabel")
eventTimer.Size = UDim2.new(1, 0, 0, 28)
eventTimer.Position = UDim2.fromOffset(0, 30)
eventTimer.BackgroundTransparency = 1
eventTimer.Font = Enum.Font.GothamSemibold
eventTimer.TextSize = 15
eventTimer.TextXAlignment = Enum.TextXAlignment.Left
eventTimer.TextColor3 = Color3.fromRGB(135, 155, 183)
eventTimer.Text = "No active event"
eventTimer.Parent = eventFrame

local actionsFrame = makePanel(screenGui, UDim2.fromOffset(310, 350), UDim2.new(1, -330, 0, 20), Color3.fromRGB(18, 23, 34))
local actionsLayout = Instance.new("UIListLayout")
actionsLayout.Padding = UDim.new(0, 10)
actionsLayout.Parent = actionsFrame

local actionsTitle = Instance.new("TextLabel")
actionsTitle.Size = UDim2.new(1, 0, 0, 30)
actionsTitle.BackgroundTransparency = 1
actionsTitle.Font = Enum.Font.GothamBlack
actionsTitle.TextSize = 23
actionsTitle.TextXAlignment = Enum.TextXAlignment.Left
actionsTitle.TextColor3 = Color3.new(1, 1, 1)
actionsTitle.Text = "ACTIONS"
actionsTitle.Parent = actionsFrame

local function makeButton(titleText, accent)
    local button = Instance.new("TextButton")
    button.Size = UDim2.new(1, 0, 0, 52)
    button.AutoButtonColor = false
    button.BackgroundColor3 = accent
    button.TextColor3 = Color3.new(1, 1, 1)
    button.Text = titleText
    button.Font = Enum.Font.GothamBold
    button.TextSize = 16
    button.Parent = actionsFrame

    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 10)
    corner.Parent = button

    button.MouseEnter:Connect(function()
        TweenService:Create(button, TweenInfo.new(0.16), { BackgroundTransparency = 0.15 }):Play()
    end)
    button.MouseLeave:Connect(function()
        TweenService:Create(button, TweenInfo.new(0.16), { BackgroundTransparency = 0 }):Play()
    end)

    return button
end

local rebirthButton = makeButton("Rebirth [R]", Color3.fromRGB(90, 119, 255))
local jumpButton = makeButton("Upgrade Jump [1]", Color3.fromRGB(87, 179, 136))
local sprintButton = makeButton("Upgrade Sprint [2]", Color3.fromRGB(242, 158, 84))
local dailyButton = makeButton("Claim Daily [F]", Color3.fromRGB(138, 99, 247))

local hint = Instance.new("TextLabel")
hint.Size = UDim2.new(1, 0, 0, 64)
hint.BackgroundTransparency = 1
hint.TextWrapped = true
hint.Font = Enum.Font.GothamSemibold
hint.TextSize = 13
hint.TextColor3 = Color3.fromRGB(150, 164, 190)
hint.Text = "Progress path: Run > Pads/Orbs > Quests > Zone unlocks > Wins > Rebirth > Repeat faster."
hint.Parent = actionsFrame

local notifyHolder = Instance.new("Frame")
notifyHolder.Size = UDim2.fromOffset(460, 260)
notifyHolder.AnchorPoint = Vector2.new(0.5, 1)
notifyHolder.Position = UDim2.new(0.5, 0, 1, -20)
notifyHolder.BackgroundTransparency = 1
notifyHolder.Parent = screenGui

local notifyList = Instance.new("UIListLayout")
notifyList.VerticalAlignment = Enum.VerticalAlignment.Bottom
notifyList.HorizontalAlignment = Enum.HorizontalAlignment.Center
notifyList.Padding = UDim.new(0, 8)
notifyList.Parent = notifyHolder

local function toast(titleText, messageText)
    local frame = Instance.new("Frame")
    frame.Size = UDim2.fromOffset(440, 58)
    frame.BackgroundColor3 = Color3.fromRGB(20, 26, 39)
    frame.BackgroundTransparency = 0.08
    frame.Parent = notifyHolder

    local corner = Instance.new("UICorner")
    corner.CornerRadius = UDim.new(0, 10)
    corner.Parent = frame

    local stroke = Instance.new("UIStroke")
    stroke.Color = Color3.fromRGB(70, 122, 255)
    stroke.Transparency = 0.34
    stroke.Parent = frame

    local titleLabel = Instance.new("TextLabel")
    titleLabel.Size = UDim2.fromOffset(420, 22)
    titleLabel.Position = UDim2.fromOffset(10, 5)
    titleLabel.BackgroundTransparency = 1
    titleLabel.Font = Enum.Font.GothamBold
    titleLabel.TextSize = 16
    titleLabel.TextColor3 = Color3.fromRGB(241, 245, 255)
    titleLabel.TextXAlignment = Enum.TextXAlignment.Left
    titleLabel.Text = titleText
    titleLabel.Parent = frame

    local messageLabel = Instance.new("TextLabel")
    messageLabel.Size = UDim2.fromOffset(420, 24)
    messageLabel.Position = UDim2.fromOffset(10, 28)
    messageLabel.BackgroundTransparency = 1
    messageLabel.Font = Enum.Font.GothamSemibold
    messageLabel.TextSize = 14
    messageLabel.TextColor3 = Color3.fromRGB(167, 184, 218)
    messageLabel.TextXAlignment = Enum.TextXAlignment.Left
    messageLabel.Text = messageText or ""
    messageLabel.Parent = frame

    frame.BackgroundTransparency = 1
    TweenService:Create(frame, TweenInfo.new(0.2), { BackgroundTransparency = 0.08 }):Play()

    task.delay(3.3, function()
        if not frame.Parent then
            return
        end
        local tween = TweenService:Create(frame, TweenInfo.new(0.26), { BackgroundTransparency = 1 })
        tween:Play()
        tween.Completed:Wait()
        frame:Destroy()
    end)
end

local function fireAction(action)
    actionRemote:FireServer({ action = action })
end

rebirthButton.MouseButton1Click:Connect(function()
    fireAction("rebirth")
end)

jumpButton.MouseButton1Click:Connect(function()
    fireAction("buy_jump")
end)

sprintButton.MouseButton1Click:Connect(function()
    fireAction("buy_sprint")
end)

dailyButton.MouseButton1Click:Connect(function()
    fireAction("claim_daily")
end)

UserInputService.InputBegan:Connect(function(input, processed)
    if processed then
        return
    end

    if input.KeyCode == Enum.KeyCode.R then
        fireAction("rebirth")
    elseif input.KeyCode == Enum.KeyCode.One then
        fireAction("buy_jump")
    elseif input.KeyCode == Enum.KeyCode.Two then
        fireAction("buy_sprint")
    elseif input.KeyCode == Enum.KeyCode.F then
        fireAction("claim_daily")
    end
end)

local function updateUi(state)
    if type(state) ~= "table" then
        return
    end

    local profile = type(state.profile) == "table" and state.profile or defaultProfile
    local computed = type(state.computed) == "table" and state.computed or defaultComputed
    local event = type(state.event) == "table" and state.event or defaultEvent
    local progression = type(state.progression) == "table" and state.progression or defaultProgression
    local zone = type(progression.zone) == "table" and progression.zone or defaultProgression.zone
    local quest = type(progression.quest) == "table" and progression.quest or defaultProgression.quest

    speedValue.Text = formatNumber(profile.speed)
    stepsValue.Text = formatNumber(profile.steps)
    gemsValue.Text = formatNumber(profile.gems)
    winsValue.Text = formatNumber(profile.wins)
    rebirthsValue.Text = formatNumber(profile.rebirths)
    zoneValue.Text = string.format("%s (x%.2f)", tostring(zone.title or "Unknown"), tonumber(zone.gainMultiplier) or 1)

    rebirthButton.Text = string.format("Rebirth [R] - Need %s Speed", formatNumber(computed.rebirthCost or 0))

    local jumpLevel = (profile.upgrades and profile.upgrades.jump) or 0
    local sprintLevel = (profile.upgrades and profile.upgrades.sprint) or 0
    jumpButton.Text = string.format("Upgrade Jump [1] - Lv.%d (%s Gems)", jumpLevel, formatNumber(computed.jumpUpgradeCost or 0))
    sprintButton.Text = string.format("Upgrade Sprint [2] - Lv.%d (%s Gems)", sprintLevel, formatNumber(computed.sprintUpgradeCost or 0))

    local remaining = tonumber(computed.dailyClaimRemaining) or 0
    if remaining <= 0 then
        dailyButton.Text = "Claim Daily [F] - Ready"
        dailyButton.BackgroundColor3 = Color3.fromRGB(138, 99, 247)
    else
        dailyButton.Text = "Claim Daily [F] - " .. formatDuration(remaining)
        dailyButton.BackgroundColor3 = Color3.fromRGB(92, 78, 134)
    end

    questDesc.Text = tostring(quest.title or "No quest")
    local target = math.max(1, tonumber(quest.target) or 1)
    local progress = math.max(0, tonumber(quest.progress) or 0)
    local alpha = math.clamp(progress / target, 0, 1)
    TweenService:Create(questBarFill, TweenInfo.new(0.2), { Size = UDim2.fromScale(alpha, 1) }):Play()
    questReward.Text = string.format("Progress %s / %s | Reward: +%s Gems, +%s Speed", formatNumber(progress), formatNumber(target), formatNumber(quest.rewardGems or 0), formatNumber(quest.rewardSpeed or 0))

    if event.active then
        eventLabel.Text = "Event: " .. tostring(event.title or "Unknown")
        eventTimer.Text = string.format("Ends in %ds | x%.2f speed | x%.2f gems", event.remaining or 0, event.speedMultiplier or 1, event.gemsMultiplier or 1)
    else
        eventLabel.Text = "Event: No Event"
        eventTimer.Text = "No active event"
    end

    local targetWalkSpeed = tonumber(computed.walkSpeed) or 16
    local targetFov = math.clamp(baseFov + ((targetWalkSpeed - 16) * 0.11), baseFov, 110)
    if camera then
        TweenService:Create(camera, TweenInfo.new(0.24), { FieldOfView = targetFov }):Play()
    end
end

stateRemote.OnClientEvent:Connect(updateUi)

notifyRemote.OnClientEvent:Connect(function(payload)
    if type(payload) ~= "table" then
        return
    end

    local titleText = tostring(payload.title or "Update")
    local message = payload.message
    if not message then
        local speedGain = tonumber(payload.speedGain) or 0
        local gemGain = tonumber(payload.gemGain) or 0
        message = string.format("+%s Speed, +%s Gems", formatNumber(speedGain), formatNumber(gemGain))
    end

    toast(titleText, tostring(message))
end)

local ok, initialState = pcall(function(): any
    return getStateRemote:InvokeServer()
end)

if ok and type(initialState) == "table" then
    updateUi(initialState)
else
    toast("SpeedSim", "Waiting for server state...")
end

print("[SpeedSim] Client UI loaded")
