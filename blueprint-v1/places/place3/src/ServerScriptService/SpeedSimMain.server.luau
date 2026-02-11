local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local speedSimConfigModule = ReplicatedStorage:WaitForChild("SpeedSimConfig")
local requireAny: any = require
local Config = requireAny(speedSimConfigModule)

local REMOTES_NAME = "SpeedSimRemotes"
local WORLD_NAME = "SpeedSimWorld"

local profiles = {}
local saveCooldowns = {}
local touchCooldowns = {}

local eventState = {
    active = false,
    id = "none",
    title = "No Event",
    speedMultiplier = 1,
    gemsMultiplier = 1,
    gravityScale = 1,
    endsAt = 0,
}

local defaultGravity = workspace.Gravity
local profileStore = DataStoreService:GetDataStore(Config.DataStoreName)

local function deepCopy(tableValue)
    local output = {}
    for key, value in pairs(tableValue) do
        if type(value) == "table" then
            output[key] = deepCopy(value)
        else
            output[key] = value
        end
    end
    return output
end

local function now()
    return os.clock()
end

local function getZone(index)
    local zones = Config.World.Zones
    if type(zones) ~= "table" or #zones == 0 then
        return {
            id = "default",
            title = "Default Zone",
            requiredSpeed = 0,
            gainMultiplier = 1,
            gemsMultiplier = 1,
            color = Color3.fromRGB(255, 255, 255),
        }, 1
    end

    local clamped = math.clamp(index, 1, #zones)
    return zones[clamped], clamped
end

local function createDefaultProfile()
    return {
        speed = 0,
        steps = 0,
        gems = 0,
        wins = 0,
        rebirths = 0,
        upgrades = {
            jump = 0,
            sprint = 0,
        },
        unlockedZoneIndex = 1,
        questIndex = 1,
        questProgress = 0,
        dailyClaimAt = 0,
        joinedAt = os.time(),
        updatedAt = os.time(),
    }
end

local function getRebirthCost(rebirths)
    return math.floor(Config.RebirthBaseCost * (Config.RebirthGrowth ^ rebirths))
end

local function getUpgradeCost(upgradeId, currentLevel)
    local shop = Config.Shop[upgradeId]
    if not shop then
        return math.huge
    end
    return math.floor(shop.baseCost * (shop.growth ^ currentLevel))
end

local function getSprintMultiplier(profile)
    local sprintLevel = tonumber(profile.upgrades.sprint) or 0
    return 1 + (sprintLevel * Config.SprintUpgradeMultiplier)
end

local function getActiveZone(profile)
    local zone, zoneIndex = getZone(tonumber(profile.unlockedZoneIndex) or 1)
    return zone, zoneIndex
end

local function getQuest(profile)
    local quests = Config.Quests
    if type(quests) ~= "table" or #quests == 0 then
        return {
            id = "none",
            title = "No Quest",
            target = 1,
            rewardGems = 0,
            rewardSpeed = 0,
        }, 1
    end

    local index = profile.questIndex or 1
    index = ((index - 1) % #quests) + 1
    return quests[index], index
end

local function getDailyRemaining(profile)
    local last = tonumber(profile.dailyClaimAt) or 0
    local cooldown = Config.DailyClaimCooldownSeconds
    local elapsed = os.time() - last
    return math.max(0, cooldown - elapsed)
end

local function computeWalkSpeed(profile)
    local speedStat = Config.BaseWalkSpeed + ((tonumber(profile.speed) or 0) * Config.WalkSpeedPerSpeed)
    return math.clamp(speedStat, Config.BaseWalkSpeed, Config.MaxWalkSpeed)
end

local function computeJumpPower(profile)
    local baseJumpPower = tonumber(Config.BaseJumpPower) or 50
    local jumpGain = tonumber(Config.JumpPowerPerUpgrade) or 0
    local jumpPower = baseJumpPower + ((tonumber(profile.upgrades.jump) or 0) * jumpGain)
    return math.max(baseJumpPower, jumpPower)
end

local function profileFor(player)
    return profiles[player.UserId]
end

local function ensureFolder(parent, name)
    local existing = parent:FindFirstChild(name)
    if existing then
        return existing
    end
    local folder = Instance.new("Folder")
    folder.Name = name
    folder.Parent = parent
    return folder
end

local function ensureRemote(className, name, parent)
    local existing = parent:FindFirstChild(name)
    if existing and existing.ClassName == className then
        return existing
    end
    if existing then
        existing:Destroy()
    end
    local remote = Instance.new(className)
    remote.Name = name
    remote.Parent = parent
    return remote
end

local remotesFolder = ensureFolder(ReplicatedStorage, REMOTES_NAME)
local stateRemote = ensureRemote("RemoteEvent", "State", remotesFolder)
local notifyRemote = ensureRemote("RemoteEvent", "Notify", remotesFolder)
local actionRemote = ensureRemote("RemoteEvent", "Action", remotesFolder)
local getStateRemote: any = ensureRemote("RemoteFunction", "GetState", remotesFolder)

local function notify(player, title, message, speedGain, gemGain)
    notifyRemote:FireClient(player, {
        title = title or "Update",
        message = message or "",
        speedGain = speedGain or 0,
        gemGain = gemGain or 0,
    })
end

local function serializeState(player, profile)
    local zone, zoneIndex = getActiveZone(profile)
    local quest = getQuest(profile)

    return {
        player = {
            userId = player.UserId,
            name = player.Name,
            displayName = player.DisplayName,
        },
        profile = {
            speed = profile.speed,
            steps = profile.steps,
            gems = profile.gems,
            wins = profile.wins,
            rebirths = profile.rebirths,
            upgrades = deepCopy(profile.upgrades),
            unlockedZoneIndex = zoneIndex,
            questIndex = profile.questIndex,
            questProgress = profile.questProgress,
            dailyClaimAt = profile.dailyClaimAt,
        },
        computed = {
            walkSpeed = computeWalkSpeed(profile),
            jumpPower = tonumber((computeJumpPower :: any)(profile)) or 0,
            rebirthCost = getRebirthCost(profile.rebirths),
            jumpUpgradeCost = getUpgradeCost("jump", profile.upgrades.jump),
            sprintUpgradeCost = getUpgradeCost("sprint", profile.upgrades.sprint),
            maxJumpUpgrade = Config.MaxJumpUpgrade,
            maxSprintUpgrade = Config.MaxSprintUpgrade,
            winGateSpeed = Config.WinGateSpeed,
            dailyClaimRemaining = getDailyRemaining(profile),
        },
        progression = {
            zone = {
                index = zoneIndex,
                id = zone.id,
                title = zone.title,
                gainMultiplier = zone.gainMultiplier,
                gemsMultiplier = zone.gemsMultiplier,
            },
            quest = {
                id = quest.id,
                title = quest.title,
                target = quest.target,
                progress = profile.questProgress,
                rewardGems = quest.rewardGems,
                rewardSpeed = quest.rewardSpeed,
            },
        },
        event = {
            active = eventState.active,
            id = eventState.id,
            title = eventState.title,
            speedMultiplier = eventState.speedMultiplier,
            gemsMultiplier = eventState.gemsMultiplier,
            gravityScale = eventState.gravityScale,
            remaining = math.max(0, math.floor(eventState.endsAt - os.time())),
        },
    }
end

local function pushState(player)
    local profile = profileFor(player)
    if not profile then
        return
    end
    stateRemote:FireClient(player, serializeState(player, profile))
end

local function pushAllStates()
    for _, player in ipairs(Players:GetPlayers()) do
        pushState(player)
    end
end

local function applyCharacterStats(player)
    local profile = profileFor(player)
    if not profile then
        return
    end
    local character = player.Character
    if not character then
        return
    end

    local humanoid = character:FindFirstChildOfClass("Humanoid")
    if not humanoid then
        return
    end

    humanoid.WalkSpeed = computeWalkSpeed(profile)
    humanoid.JumpPower = computeJumpPower(profile)
end

local function updateLeaderstats(player)
    local profile = profileFor(player)
    if not profile then
        return
    end

    local leaderstats = player:FindFirstChild("leaderstats")
    if not leaderstats then
        return
    end

    leaderstats.Speed.Value = math.floor(profile.speed)
    leaderstats.Steps.Value = math.floor(profile.steps)
    leaderstats.Gems.Value = math.floor(profile.gems)
    leaderstats.Wins.Value = math.floor(profile.wins)
    leaderstats.Rebirths.Value = math.floor(profile.rebirths)
    leaderstats.Zone.Value = profile.unlockedZoneIndex
end

local function markDirty(player)
    local profile = profileFor(player)
    if not profile then
        return
    end
    profile.updatedAt = os.time()
end

local function addQuestProgress(player, questType, amount)
    local profile = profileFor(player)
    if not profile or amount <= 0 then
        return
    end

    local quest = getQuest(profile)
    if quest.id ~= questType then
        return
    end

    profile.questProgress += amount

    while profile.questProgress >= quest.target do
        profile.questProgress -= quest.target
        profile.gems += quest.rewardGems
        profile.speed += quest.rewardSpeed
        profile.steps += quest.rewardSpeed
        profile.questIndex += 1

        notify(player, "Quest Complete", quest.title .. " complete!", quest.rewardSpeed, quest.rewardGems)

        local nextQuest = getQuest(profile)
        quest = nextQuest
    end
end

local function reward(player, speedGain, gemGain, reason, questType, questAmount)
    local profile = profileFor(player)
    if not profile then
        return
    end

    local zone = getActiveZone(profile)
    local eventSpeed = eventState.active and eventState.speedMultiplier or 1
    local eventGems = eventState.active and eventState.gemsMultiplier or 1

    local finalSpeed = 0
    local finalGems = 0

    if speedGain > 0 then
        finalSpeed = math.max(1, math.floor(speedGain * zone.gainMultiplier * eventSpeed))
        profile.speed += finalSpeed
        profile.steps += finalSpeed
    end

    if gemGain > 0 then
        finalGems = math.max(1, math.floor(gemGain * zone.gemsMultiplier * eventGems))
        profile.gems += finalGems
    end

    if questType then
        local progress = questAmount or 1
        addQuestProgress(player, questType, progress)
    end

    markDirty(player)
    updateLeaderstats(player)
    applyCharacterStats(player)
    pushState(player)

    if type(reason) == "string" and reason ~= "" then
        notify(player, reason, "", finalSpeed, finalGems)
    end
end

local function saveProfile(player)
    local profile = profileFor(player)
    if not profile then
        return
    end

    local stamp = now()
    local last = saveCooldowns[player.UserId] or 0
    if stamp - last < 2 then
        return
    end
    saveCooldowns[player.UserId] = stamp

    local key = tostring(player.UserId)
    local payload = deepCopy(profile)

    local ok, err = pcall(function()
        profileStore:SetAsync(key, payload)
    end)

    if not ok then
        warn("[SpeedSim] Failed to save profile for", player.Name, err)
    end
end

local function loadProfile(player)
    local profile = createDefaultProfile()
    local ok, data = pcall(function(): any
        return profileStore:GetAsync(tostring(player.UserId))
    end)

    if ok and type(data) == "table" then
        profile.speed = tonumber(data.speed) or profile.speed
        profile.steps = tonumber(data.steps) or profile.steps
        profile.gems = tonumber(data.gems) or profile.gems
        profile.wins = tonumber(data.wins) or profile.wins
        profile.rebirths = tonumber(data.rebirths) or profile.rebirths
        profile.unlockedZoneIndex = tonumber(data.unlockedZoneIndex) or profile.unlockedZoneIndex
        profile.questIndex = tonumber(data.questIndex) or profile.questIndex
        profile.questProgress = tonumber(data.questProgress) or profile.questProgress
        profile.dailyClaimAt = tonumber(data.dailyClaimAt) or profile.dailyClaimAt
        if type(data.upgrades) == "table" then
            profile.upgrades.jump = tonumber(data.upgrades.jump) or profile.upgrades.jump
            profile.upgrades.sprint = tonumber(data.upgrades.sprint) or profile.upgrades.sprint
        end
        profile.joinedAt = tonumber(data.joinedAt) or profile.joinedAt
        profile.updatedAt = tonumber(data.updatedAt) or profile.updatedAt
    elseif not ok then
        warn("[SpeedSim] Failed to load profile for", player.Name, data)
    end

    local _, clampedZone = getZone(profile.unlockedZoneIndex)
    profile.unlockedZoneIndex = clampedZone
    profiles[player.UserId] = profile
end

local function canTouch(player, key, cooldown)
    touchCooldowns[player.UserId] = touchCooldowns[player.UserId] or {}
    local data = touchCooldowns[player.UserId]
    local stamp = now()
    local last = data[key] or 0
    if stamp - last < cooldown then
        return false
    end
    data[key] = stamp
    return true
end

local worldFolder = workspace:FindFirstChild(WORLD_NAME)
if worldFolder then
    worldFolder:Destroy()
end
worldFolder = Instance.new("Folder")
worldFolder.Name = WORLD_NAME
worldFolder.Parent = workspace

local function createLabel(parent, text, size, offset, color, strokeTransparency)
    local gui = Instance.new("BillboardGui")
    gui.AlwaysOnTop = true
    gui.Size = size
    gui.StudsOffsetWorldSpace = offset
    gui.Parent = parent

    local label = Instance.new("TextLabel")
    label.Size = UDim2.fromScale(1, 1)
    label.BackgroundTransparency = 1
    label.TextScaled = true
    label.Font = Enum.Font.GothamBlack
    label.TextColor3 = color or Color3.new(1, 1, 1)
    label.TextStrokeTransparency = strokeTransparency or 0.45
    label.Text = text
    label.Parent = gui

    return label
end

local function buildWorld()
    local world = Config.World

    local ground = Instance.new("Part")
    ground.Name = "Ground"
    ground.Anchored = true
    ground.Size = world.GroundSize
    ground.Position = Vector3.new(world.HubCenter.X, world.GroundY, world.HubCenter.Z)
    ground.Color = Color3.fromRGB(28, 31, 39)
    ground.Material = Enum.Material.Slate
    ground.TopSurface = Enum.SurfaceType.Smooth
    ground.Parent = worldFolder

    local zoneFolder = Instance.new("Folder")
    zoneFolder.Name = "Zones"
    zoneFolder.Parent = worldFolder

    for index, zone in ipairs(world.Zones) do
        local lane = Instance.new("Part")
        lane.Name = "Lane_" .. zone.id
        lane.Anchored = true
        lane.Size = zone.laneSize
        lane.Position = zone.laneCenter
        lane.Color = zone.color:Lerp(Color3.fromRGB(8, 8, 8), 0.7)
        lane.Material = Enum.Material.SmoothPlastic
        lane.Parent = zoneFolder

        local gate = Instance.new("Part")
        gate.Name = "Gate_" .. zone.id
        gate.Anchored = true
        gate.Size = Vector3.new(42, 16, 4)
        gate.Position = zone.gatePosition
        gate.Material = Enum.Material.Neon
        gate.Color = zone.color
        gate.Transparency = 0.25
        gate.Parent = zoneFolder

        local gateLabelText = zone.title
        if zone.requiredSpeed > 0 then
            gateLabelText = gateLabelText .. "\nNeed " .. zone.requiredSpeed .. " Speed"
        else
            gateLabelText = gateLabelText .. "\nUnlocked"
        end
        createLabel(gate, gateLabelText, UDim2.fromOffset(240, 90), Vector3.new(0, 10, 0), Color3.fromRGB(255, 255, 255), 0.45)

        gate.Touched:Connect(function(hit)
            local character = hit.Parent
            if not character then
                return
            end
            local player = Players:GetPlayerFromCharacter(character)
            if not player then
                return
            end
            if not canTouch(player, "zone_gate_" .. index, 1.8) then
                return
            end

            local profile = profileFor(player)
            if not profile then
                return
            end

            if profile.unlockedZoneIndex >= index then
                return
            end

            if profile.speed < zone.requiredSpeed then
                notify(player, "Zone Locked", ("Need %d speed to unlock %s."):format(zone.requiredSpeed, zone.title), 0, 0)
                return
            end

            profile.unlockedZoneIndex = index
            markDirty(player)
            updateLeaderstats(player)
            pushState(player)

            notify(player, "Zone Unlocked", zone.title .. " is now active!", 0, 0)
        end)
    end

    local gate = Instance.new("Part")
    gate.Name = "WinGate"
    gate.Anchored = true
    gate.Size = world.PortalSize
    gate.Position = world.PortalPosition
    gate.Material = Enum.Material.Neon
    gate.Color = Color3.fromRGB(73, 173, 255)
    gate.Transparency = 0.2
    gate.Parent = worldFolder

    createLabel(gate, ("WIN GATE\nNeed %d Speed"):format(Config.WinGateSpeed), UDim2.fromOffset(250, 80), Vector3.new(0, 12, 0), Color3.new(1, 1, 1), 0.4)

    gate.Touched:Connect(function(hit)
        local character = hit.Parent
        if not character then
            return
        end
        local player = Players:GetPlayerFromCharacter(character)
        if not player then
            return
        end

        if not canTouch(player, "win_gate", 2.2) then
            return
        end

        local profile = profileFor(player)
        if not profile then
            return
        end

        if profile.speed < Config.WinGateSpeed then
            notify(player, "Gate Locked", ("Need %d speed to claim wins."):format(Config.WinGateSpeed), 0, 0)
            return
        end

        profile.wins += 1
        markDirty(player)
        reward(player, Config.WinRewardSpeed, Config.WinRewardGems, "Win Claimed", "claim_wins", 1)
    end)

    local boosters = Instance.new("Folder")
    boosters.Name = "BoosterPads"
    boosters.Parent = worldFolder

    for index, padConfig in ipairs(world.BoosterPads) do
        local pad = Instance.new("Part")
        pad.Name = "Pad_" .. index
        pad.Anchored = true
        pad.Size = Vector3.new(18, 1, 18)
        pad.Position = padConfig.position
        pad.Color = padConfig.color
        pad.Material = Enum.Material.Neon
        pad.Parent = boosters

        createLabel(pad, ("%s\n+%d Speed"):format(padConfig.title, padConfig.gain), UDim2.fromOffset(170, 60), Vector3.new(0, 5, 0), Color3.new(1, 1, 1), 0.5)

        pad.Touched:Connect(function(hit)
            local character = hit.Parent
            if not character then
                return
            end
            local player = Players:GetPlayerFromCharacter(character)
            if not player then
                return
            end

            local key = "pad_" .. index
            if not canTouch(player, key, 1.15) then
                return
            end

            reward(player, padConfig.gain, padConfig.gems, padConfig.title, "use_pads", 1)
        end)
    end

    local orbFolder = Instance.new("Folder")
    orbFolder.Name = "Orbs"
    orbFolder.Parent = worldFolder

    local bounds = world.OrbBounds

    local function randomOrbPosition()
        return Vector3.new(
            math.random(bounds.minX, bounds.maxX),
            bounds.y,
            math.random(bounds.minZ, bounds.maxZ)
        )
    end

    local function spawnOrb(orb)
        orb.Position = randomOrbPosition()
        orb.Transparency = 0
        orb.CanTouch = true
        orb:SetAttribute("Active", true)

        local tween = TweenService:Create(
            orb,
            TweenInfo.new(0.8, Enum.EasingStyle.Sine, Enum.EasingDirection.Out),
            { Color = Color3.fromRGB(107, 254, 255) }
        )
        tween:Play()
    end

    for i = 1, Config.OrbCount do
        local orb = Instance.new("Part")
        orb.Name = "Orb_" .. i
        orb.Shape = Enum.PartType.Ball
        orb.Anchored = true
        orb.CanCollide = false
        orb.Size = Vector3.new(2.2, 2.2, 2.2)
        orb.Material = Enum.Material.Neon
        orb.Color = Color3.fromRGB(76, 201, 255)
        orb.Parent = orbFolder

        spawnOrb(orb)

        orb.Touched:Connect(function(hit)
            if not orb:GetAttribute("Active") then
                return
            end

            local character = hit.Parent
            if not character then
                return
            end
            local player = Players:GetPlayerFromCharacter(character)
            if not player then
                return
            end

            orb:SetAttribute("Active", false)
            orb.CanTouch = false
            orb.Transparency = 1

            reward(player, Config.OrbReward, Config.OrbReward, "Orb Collected", "collect_orbs", 1)

            task.delay(Config.OrbRespawnSeconds, function()
                if orb.Parent then
                    spawnOrb(orb)
                end
            end)
        end)
    end
end

buildWorld()

local function createLeaderstats(player)
    local folder = Instance.new("Folder")
    folder.Name = "leaderstats"
    folder.Parent = player

    local speed = Instance.new("IntValue")
    speed.Name = "Speed"
    speed.Parent = folder

    local steps = Instance.new("IntValue")
    steps.Name = "Steps"
    steps.Parent = folder

    local gems = Instance.new("IntValue")
    gems.Name = "Gems"
    gems.Parent = folder

    local wins = Instance.new("IntValue")
    wins.Name = "Wins"
    wins.Parent = folder

    local rebirths = Instance.new("IntValue")
    rebirths.Name = "Rebirths"
    rebirths.Parent = folder

    local zone = Instance.new("IntValue")
    zone.Name = "Zone"
    zone.Parent = folder
end

local function onAction(player, action)
    local profile = profileFor(player)
    if not profile then
        return
    end

    if action == "rebirth" then
        local cost = getRebirthCost(profile.rebirths)
        if profile.speed < cost then
            notify(player, "Rebirth Failed", ("Need %d speed."):format(cost), 0, 0)
            return
        end

        profile.speed = 0
        profile.steps = 0
        profile.rebirths += 1
        profile.gems += 50 + (profile.rebirths * 10)
        markDirty(player)

        notify(player, "Rebirth Complete", ("Rebirth #%d unlocked! Passive gains boosted."):format(profile.rebirths), 0, 0)
    elseif action == "buy_jump" then
        if profile.upgrades.jump >= Config.MaxJumpUpgrade then
            notify(player, "Maxed", "Jump Core is max level.", 0, 0)
            return
        end

        local cost = getUpgradeCost("jump", profile.upgrades.jump)
        if profile.gems < cost then
            notify(player, "Not Enough Gems", ("Need %d gems."):format(cost), 0, 0)
            return
        end

        profile.gems -= cost
        profile.upgrades.jump += 1
        markDirty(player)
        notify(player, "Upgrade Purchased", ("Jump Core Lv.%d"):format(profile.upgrades.jump), 0, 0)
    elseif action == "buy_sprint" then
        if profile.upgrades.sprint >= Config.MaxSprintUpgrade then
            notify(player, "Maxed", "Sprint Engine is max level.", 0, 0)
            return
        end

        local cost = getUpgradeCost("sprint", profile.upgrades.sprint)
        if profile.gems < cost then
            notify(player, "Not Enough Gems", ("Need %d gems."):format(cost), 0, 0)
            return
        end

        profile.gems -= cost
        profile.upgrades.sprint += 1
        markDirty(player)
        notify(player, "Upgrade Purchased", ("Sprint Engine Lv.%d"):format(profile.upgrades.sprint), 0, 0)
    elseif action == "claim_daily" then
        local remaining = getDailyRemaining(profile)
        if remaining > 0 then
            notify(player, "Daily Locked", ("Daily reward in %dm %ds"):format(math.floor(remaining / 60), remaining % 60), 0, 0)
            return
        end

        profile.dailyClaimAt = os.time()
        markDirty(player)
        reward(player, Config.DailyClaimSpeed, Config.DailyClaimGems, "Daily Reward", "gain_speed", Config.DailyClaimSpeed)
    end

    updateLeaderstats(player)
    applyCharacterStats(player)
    pushState(player)
end

(getStateRemote :: any).OnServerInvoke = function(player): any
    local profile = profileFor(player)
    if not profile then
        return nil
    end
    return serializeState(player, profile)
end

actionRemote.OnServerEvent:Connect(function(player, payload)
    if type(payload) ~= "table" then
        return
    end
    onAction(player, payload.action)
end)

local function initializePlayer(player)
    loadProfile(player)
    createLeaderstats(player)
    updateLeaderstats(player)

    player.CharacterAdded:Connect(function()
        task.wait(0.15)
        applyCharacterStats(player)
        pushState(player)
    end)

    pushState(player)
end

Players.PlayerAdded:Connect(initializePlayer)
for _, player in ipairs(Players:GetPlayers()) do
    task.spawn(initializePlayer, player)
end

Players.PlayerRemoving:Connect(function(player)
    saveProfile(player)
    profiles[player.UserId] = nil
    touchCooldowns[player.UserId] = nil
end)

local saveAccumulator = 0
local stepAccumulator = 0
RunService.Heartbeat:Connect(function(dt)
    saveAccumulator += dt
    stepAccumulator += dt

    if stepAccumulator >= 0.25 then
        stepAccumulator = 0

        for _, player in ipairs(Players:GetPlayers()) do
            local profile = profileFor(player)
            if profile then
                local character = player.Character
                local humanoid = character and character:FindFirstChildOfClass("Humanoid")
                if humanoid and humanoid.MoveDirection.Magnitude > 0.12 then
                    local rebirthMultiplier = 1 + (profile.rebirths * Config.RebirthSpeedMultiplier)
                    local gain = Config.BaseSpeedGainPerStep * rebirthMultiplier * getSprintMultiplier(profile)
                    reward(player, gain, 0, "", "gain_speed", math.max(1, math.floor(gain)))
                end
            end
        end
    end

    if saveAccumulator >= Config.SaveIntervalSeconds then
        saveAccumulator = 0
        for _, player in ipairs(Players:GetPlayers()) do
            saveProfile(player)
        end
    end
end)

task.spawn(function()
    while true do
        task.wait(Config.EventCooldownSeconds)

        local options = Config.Events
        if #options == 0 then
            continue
        end

        local chosen = options[math.random(1, #options)]
        eventState.active = true
        eventState.id = chosen.id
        eventState.title = chosen.title
        eventState.speedMultiplier = chosen.speedMultiplier
        eventState.gemsMultiplier = chosen.gemsMultiplier
        eventState.gravityScale = chosen.gravityScale
        eventState.endsAt = os.time() + Config.EventDurationSeconds

        workspace.Gravity = defaultGravity * eventState.gravityScale

        pushAllStates()
        for _, player in ipairs(Players:GetPlayers()) do
            notify(player, "World Event", chosen.title .. " started!", 0, 0)
        end

        task.wait(Config.EventDurationSeconds)

        eventState.active = false
        eventState.id = "none"
        eventState.title = "No Event"
        eventState.speedMultiplier = 1
        eventState.gemsMultiplier = 1
        eventState.gravityScale = 1
        eventState.endsAt = 0

        workspace.Gravity = defaultGravity
        pushAllStates()
    end
end)

game:BindToClose(function()
    for _, player in ipairs(Players:GetPlayers()) do
        saveProfile(player)
    end
end)

print("[SpeedSim] Server initialized")
