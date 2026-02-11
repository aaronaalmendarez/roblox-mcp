local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")

local PLOT_COUNT = 4
local PLOT_RADIUS = 220
local PLOT_CENTER = Vector3.new(0, 0, 0)
local BASE_SIZE = Vector3.new(120, 1, 120)

local START_MONEY = 200
local REBIRTH_BASE_COST = 5000
local MAX_STAGE = 20
local REBIRTHS_PER_STAGE = 3
local MAX_EQUIPPED_ITEMS = 2
local PICKUP_MAX_PER_PLOT = 3
local BASE_WALK_SPEED = 16
local BASE_JUMP_POWER = 50
local MAX_SPEED_LEVEL = 30
local MAX_JUMP_LEVEL = 30
local MAX_JETPACK_LEVEL = 12
local AUTOSAVE_SECONDS = 60
local DATASTORE_NAME = "NovaTycoonSim_v1"

local PURCHASES = {
    { id = "dropper_alpha", name = "Dropper Alpha", cost = 100, income = 3, color = Color3.fromRGB(77, 184, 255) },
    { id = "dropper_beta", name = "Dropper Beta", cost = 250, income = 7, color = Color3.fromRGB(135, 108, 255) },
    { id = "factory_core", name = "Factory Core", cost = 450, income = 14, color = Color3.fromRGB(255, 186, 73) },
    { id = "neon_sign", name = "Neon Sign", cost = 350, income = 2, color = Color3.fromRGB(255, 83, 174) },
    { id = "gold_statue", name = "Gold Statue", cost = 700, income = 24, color = Color3.fromRGB(255, 222, 89) },
    { id = "fusion_reactor", name = "Fusion Reactor", cost = 1600, income = 60, color = Color3.fromRGB(104, 255, 204) },
    { id = "orbital_tower", name = "Orbital Tower", cost = 3200, income = 125, color = Color3.fromRGB(255, 120, 120) },
}

local ITEMS = {
    { id = "rusty_gear", name = "Rusty Gear", rarity = "Common", weight = 55, flatIncome = 1, multBonus = 0.00 },
    { id = "luck_chip", name = "Luck Chip", rarity = "Uncommon", weight = 28, flatIncome = 3, multBonus = 0.00 },
    { id = "quantum_core", name = "Quantum Core", rarity = "Rare", weight = 12, flatIncome = 7, multBonus = 0.05 },
    { id = "mythic_cube", name = "Mythic Cube", rarity = "Legendary", weight = 5, flatIncome = 12, multBonus = 0.12 },
}

local PICKUP_DEFS = {
    { id = "money_potion", name = "Money Potion", weight = 38, color = Color3.fromRGB(90, 201, 126), apply = function(player, data)
        local duration = 45
        data.buff.name = "Money Potion"
        data.buff.moneyMult = 1.45
        data.buff.luckBonus = 0
        data.buff.expiresAt = os.clock() + duration
    end },
    { id = "luck_potion", name = "Luck Potion", weight = 28, color = Color3.fromRGB(135, 122, 255), apply = function(player, data)
        local duration = 45
        data.buff.name = "Luck Potion"
        data.buff.moneyMult = 1
        data.buff.luckBonus = 0.22
        data.buff.expiresAt = os.clock() + duration
    end },
    { id = "cash_orb", name = "Cash Orb", weight = 22, color = Color3.fromRGB(255, 204, 102), apply = function(player, data)
        local moneyVal = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Money")
        if moneyVal then
            moneyVal.Value += math.floor(200 * data.multiplier)
        end
    end },
    { id = "shard_bundle", name = "Shard Bundle", weight = 12, color = Color3.fromRGB(94, 196, 255), apply = function(player, data)
        data.shards += 35
    end },
    { id = "relic_comet", name = "Relic Comet", weight = 6, color = Color3.fromRGB(255, 96, 96), apply = function(player, data)
        data.relics += 1
    end },
}

local EVENTS = {
    { id = "none", name = "None", moneyMult = 1, shardMult = 1, luckBonus = 0, jumpBonus = 0, relicBonus = 0 },
    { id = "money_rain", name = "Money Rain", moneyMult = 1.65, shardMult = 1, luckBonus = 0, jumpBonus = 0, relicBonus = 0 },
    { id = "lucky_streak", name = "Lucky Streak", moneyMult = 1.2, shardMult = 1, luckBonus = 0.2, jumpBonus = 0, relicBonus = 0.01 },
    { id = "shard_storm", name = "Shard Storm", moneyMult = 1, shardMult = 2.2, luckBonus = 0.08, jumpBonus = 0, relicBonus = 0 },
    { id = "moon_jumps", name = "Moon Jumps", moneyMult = 1.1, shardMult = 1.1, luckBonus = 0.05, jumpBonus = 18, relicBonus = 0 },
    { id = "relic_hunt", name = "Relic Hunt", moneyMult = 1.15, shardMult = 1.2, luckBonus = 0.12, jumpBonus = 6, relicBonus = 0.06 },
}

local PATHS = {
    { id = "industrialist", name = "Industrialist", incomeMult = 1.18, shardMult = 1, luckBonus = 0, speedBonus = 0, jumpBonus = 0, jetpackCooldownMult = 1, abilityName = "Overdrive", abilityCooldown = 75 },
    { id = "explorer", name = "Explorer", incomeMult = 1.04, shardMult = 1.2, luckBonus = 0.08, speedBonus = 2, jumpBonus = 2, jetpackCooldownMult = 1, abilityName = "Magnet Sweep", abilityCooldown = 60 },
    { id = "aerialist", name = "Aerialist", incomeMult = 1.06, shardMult = 1, luckBonus = 0.03, speedBonus = 4, jumpBonus = 6, jetpackCooldownMult = 0.75, abilityName = "Sky Surge", abilityCooldown = 45 },
}

local remotesFolder = ReplicatedStorage:FindFirstChild("TycoonRemotes")
if not remotesFolder then
    remotesFolder = Instance.new("Folder")
    remotesFolder.Name = "TycoonRemotes"
    remotesFolder.Parent = ReplicatedStorage
end

local uiUpdateRemote = remotesFolder:FindFirstChild("TycoonUIUpdate")
if not uiUpdateRemote then
    uiUpdateRemote = Instance.new("RemoteEvent")
    uiUpdateRemote.Name = "TycoonUIUpdate"
    uiUpdateRemote.Parent = remotesFolder
end

local notifyRemote = remotesFolder:FindFirstChild("TycoonNotify")
if not notifyRemote then
    notifyRemote = Instance.new("RemoteEvent")
    notifyRemote.Name = "TycoonNotify"
    notifyRemote.Parent = remotesFolder
end

local actionRemote = remotesFolder:FindFirstChild("TycoonAction")
if not actionRemote then
    actionRemote = Instance.new("RemoteEvent")
    actionRemote.Name = "TycoonAction"
    actionRemote.Parent = remotesFolder
end

local world = workspace:FindFirstChild("TycoonWorld")
if not world then
    world = Instance.new("Folder")
    world.Name = "TycoonWorld"
    world.Parent = workspace
end

local playerData = {}
local currentEvent = {
    id = "none",
    name = "None",
    moneyMult = 1,
    shardMult = 1,
    luckBonus = 0,
    jumpBonus = 0,
    relicBonus = 0,
    endsAt = 0,
}

local playerStore = DataStoreService:GetDataStore(DATASTORE_NAME)

local function datastoreKey(userId)
    return "player_" .. tostring(userId)
end

local function deepCopyDictionary(source)
    local out = {}
    for k, v in pairs(source or {}) do
        if type(v) ~= "function" and type(v) ~= "userdata" and type(v) ~= "thread" then
            out[k] = v
        end
    end
    return out
end

local function sanitizeOwnedMap(source, validList)
    local valid = {}
    for _, def in ipairs(validList) do
        valid[def.id] = true
    end
    local out = {}
    for id, enabled in pairs(source or {}) do
        if valid[id] and enabled then
            out[id] = true
        end
    end
    return out
end

local function sanitizeItemCounts(source)
    local valid = {}
    for _, def in ipairs(ITEMS) do
        valid[def.id] = true
    end
    local out = {}
    for id, count in pairs(source or {}) do
        if valid[id] then
            out[id] = math.max(0, math.floor(tonumber(count) or 0))
        end
    end
    return out
end

local function computeBaseIncomeFromPurchases(purchased)
    local total = 0
    for _, purchase in ipairs(PURCHASES) do
        if purchased[purchase.id] then
            total += purchase.income
        end
    end
    return total
end

local function computeStageFromLifetimeRebirths(lifetimeRebirths)
    local raw = 1 + math.floor((math.max(0, lifetimeRebirths) / REBIRTHS_PER_STAGE))
    return math.clamp(raw, 1, MAX_STAGE)
end

local function getStage(data)
    local stage = math.floor(tonumber(data and data.stage) or 1)
    return math.clamp(stage, 1, MAX_STAGE)
end

local function stageIncomeMultiplier(stage)
    return 1 + ((stage - 1) * 0.35)
end

local function stageCostMultiplier(stage)
    return 1 + ((stage - 1) * 0.55)
end

local function speedUpgradeCost(level)
    return math.floor(35 + (level * 28) + ((level * level) * 2.2))
end

local function jumpUpgradeCost(level)
    return math.floor(35 + (level * 30) + ((level * level) * 2.5))
end

local function jetpackUpgradeCost(level)
    return math.floor(220 + (level * 170) + ((level * level) * 8))
end

local function jetpackCooldown(level)
    return math.max(0.9, 2.2 - ((math.max(level, 1) - 1) * 0.12))
end

local findPathDef

local function ensureProgress(data)
    data.progress = data.progress or {}
    data.progress.speedLevel = math.clamp(math.floor(tonumber(data.progress.speedLevel) or 0), 0, MAX_SPEED_LEVEL)
    data.progress.jumpLevel = math.clamp(math.floor(tonumber(data.progress.jumpLevel) or 0), 0, MAX_JUMP_LEVEL)
    data.progress.jetpackLevel = math.clamp(math.floor(tonumber(data.progress.jetpackLevel) or 0), 0, MAX_JETPACK_LEVEL)
    data.lastJetpackAt = tonumber(data.lastJetpackAt) or 0
    data.lastSaveAt = tonumber(data.lastSaveAt) or 0
    data.isSaving = data.isSaving == true
    data.dirty = data.dirty == true
end

local function ensurePathState(data)
    local path = findPathDef(data.pathId)
    data.pathId = path and path.id or nil
    data.pathAbilityReadyAt = tonumber(data.pathAbilityReadyAt) or 0
    data.overdriveEndsAt = tonumber(data.overdriveEndsAt) or 0
    data.overdriveNotified = data.overdriveNotified == true
    data.relics = math.max(0, math.floor(tonumber(data.relics) or 0))
    data.lifetimeRebirths = math.max(0, math.floor(tonumber(data.lifetimeRebirths) or 0))
    data.stage = computeStageFromLifetimeRebirths(data.lifetimeRebirths)
end

local function applyCharacterStats(player, data)
    local character = player.Character
    if not character then
        return
    end
    local humanoid = character:FindFirstChildOfClass("Humanoid")
    if not humanoid then
        return
    end

    ensureProgress(data)
    ensurePathState(data)
    local pathDef = findPathDef(data.pathId)
    local pathSpeed = pathDef and pathDef.speedBonus or 0
    local pathJump = pathDef and pathDef.jumpBonus or 0
    humanoid.WalkSpeed = BASE_WALK_SPEED + (data.progress.speedLevel * 2) + pathSpeed
    humanoid.JumpPower = BASE_JUMP_POWER + (data.progress.jumpLevel * 2) + pathJump + (currentEvent.jumpBonus or 0)
end

local function loadPlayerSnapshot(userId)
    local key = datastoreKey(userId)
    for _ = 1, 3 do
        local ok, result = pcall(function()
            return playerStore:GetAsync(key)
        end)
        if ok then
            if type(result) == "table" then
                return result
            end
            return nil
        end
        task.wait(0.4)
    end
    return nil
end

local function buildSavePayload(player, data)
    ensureProgress(data)
    ensurePathState(data)
    local moneyVal = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Money")
    local rebirthVal = player:FindFirstChild("leaderstats") and player.leaderstats:FindFirstChild("Rebirths")

    return {
        version = 1,
        updatedAt = os.time(),
        money = moneyVal and moneyVal.Value or START_MONEY,
        rebirths = rebirthVal and rebirthVal.Value or data.rebirths or 0,
        shards = data.shards or 0,
        relics = data.relics or 0,
        stage = data.stage or 1,
        lifetimeRebirths = data.lifetimeRebirths or 0,
        pathId = data.pathId,
        purchased = deepCopyDictionary(data.purchased),
        items = deepCopyDictionary(data.items),
        equipped = deepCopyDictionary(data.equipped),
        progress = {
            speedLevel = data.progress.speedLevel,
            jumpLevel = data.progress.jumpLevel,
            jetpackLevel = data.progress.jetpackLevel,
        },
    }
end

local function findItem(itemId)
    for _, item in ipairs(ITEMS) do
        if item.id == itemId then
            return item
        end
    end
    return nil
end

local function findPickupDef(pickupId)
    for _, def in ipairs(PICKUP_DEFS) do
        if def.id == pickupId then
            return def
        end
    end
    return nil
end

findPathDef = function(pathId)
    for _, def in ipairs(PATHS) do
        if def.id == pathId then
            return def
        end
    end
    return nil
end

local function makeLabel(parent, text, color)
    local label = Instance.new("TextLabel")
    label.BackgroundTransparency = 1
    label.Size = UDim2.new(1, 0, 1, 0)
    label.Font = Enum.Font.GothamBold
    label.TextScaled = true
    label.Text = text
    label.TextColor3 = color
    label.Parent = parent
    return label
end

local function setPartPrompt(part, promptName, actionText, objectText)
    local prompt = part:FindFirstChild(promptName)
    if not prompt then
        prompt = Instance.new("ProximityPrompt")
        prompt.Name = promptName
        prompt.RequiresLineOfSight = false
        prompt.MaxActivationDistance = 12
        prompt.HoldDuration = 0.15
        prompt.Parent = part
    end
    prompt.ActionText = actionText
    prompt.ObjectText = objectText
    return prompt
end

local function ensurePlot(i)
    local plotName = "Plot_" .. i
    local plot = world:FindFirstChild(plotName)
    if not plot then
        plot = Instance.new("Model")
        plot.Name = plotName
        plot.Parent = world
    end

    if plot:GetAttribute("OwnerUserId") == nil then
        plot:SetAttribute("OwnerUserId", 0)
    end

    local angle = ((i - 1) / PLOT_COUNT) * (math.pi * 2)
    local basePos = PLOT_CENTER + Vector3.new(math.cos(angle) * PLOT_RADIUS, 0, math.sin(angle) * PLOT_RADIUS)

    local base = plot:FindFirstChild("Base")
    if not base then
        base = Instance.new("Part")
        base.Name = "Base"
        base.Anchored = true
        base.Size = BASE_SIZE
        base.Material = Enum.Material.Concrete
        base.Color = Color3.fromRGB(47, 52, 61)
        base.Parent = plot
    end
    base.Position = basePos

    local claimPad = plot:FindFirstChild("ClaimPad")
    if not claimPad then
        claimPad = Instance.new("Part")
        claimPad.Name = "ClaimPad"
        claimPad.Anchored = true
        claimPad.Size = Vector3.new(24, 1, 24)
        claimPad.Material = Enum.Material.Neon
        claimPad.Color = Color3.fromRGB(50, 205, 50)
        claimPad.Parent = plot

        local claimGui = Instance.new("BillboardGui")
        claimGui.Name = "ClaimBillboard"
        claimGui.Size = UDim2.new(0, 240, 0, 72)
        claimGui.StudsOffset = Vector3.new(0, 4, 0)
        claimGui.AlwaysOnTop = true
        claimGui.Parent = claimPad
        makeLabel(claimGui, "UNCLAIMED", Color3.fromRGB(255, 255, 255))
    end
    claimPad.Position = basePos + Vector3.new(0, 1, -40)

    local simulatorPad = plot:FindFirstChild("SimulatorPad")
    if not simulatorPad then
        simulatorPad = Instance.new("Part")
        simulatorPad.Name = "SimulatorPad"
        simulatorPad.Anchored = true
        simulatorPad.Size = Vector3.new(22, 1, 22)
        simulatorPad.Material = Enum.Material.Neon
        simulatorPad.Color = Color3.fromRGB(78, 130, 255)
        simulatorPad.Parent = plot
    end
    simulatorPad.Position = basePos + Vector3.new(34, 1, -12)
    setPartPrompt(simulatorPad, "HarvestPrompt", "Harvest", "Simulator Node")

    local cratePad = plot:FindFirstChild("CratePad")
    if not cratePad then
        cratePad = Instance.new("Part")
        cratePad.Name = "CratePad"
        cratePad.Anchored = true
        cratePad.Size = Vector3.new(18, 1, 18)
        cratePad.Material = Enum.Material.Neon
        cratePad.Color = Color3.fromRGB(255, 150, 70)
        cratePad.Parent = plot
    end
    cratePad.Position = basePos + Vector3.new(34, 1, 12)
    setPartPrompt(cratePad, "CratePrompt", "Open", "Item Crate (50 shards)")

    local rebirthPad = plot:FindFirstChild("RebirthPad")
    if not rebirthPad then
        rebirthPad = Instance.new("Part")
        rebirthPad.Name = "RebirthPad"
        rebirthPad.Anchored = true
        rebirthPad.Size = Vector3.new(20, 1, 20)
        rebirthPad.Material = Enum.Material.Neon
        rebirthPad.Color = Color3.fromRGB(255, 90, 170)
        rebirthPad.Parent = plot
    end
    rebirthPad.Position = basePos + Vector3.new(-34, 1, -12)
    setPartPrompt(rebirthPad, "RebirthPrompt", "Rebirth", "Reset for multiplier")

    local deco = plot:FindFirstChild("Skyline")
    if not deco then
        deco = Instance.new("Part")
        deco.Name = "Skyline"
        deco.Anchored = true
        deco.CanCollide = false
        deco.Material = Enum.Material.ForceField
        deco.Transparency = 0.65
        deco.Color = Color3.fromRGB(78, 130, 255)
        deco.Size = Vector3.new(100, 28, 2)
        deco.Parent = plot
    end
    deco.Position = basePos + Vector3.new(0, 14, 52)

    local pickupsFolder = plot:FindFirstChild("Pickups")
    if not pickupsFolder then
        pickupsFolder = Instance.new("Folder")
        pickupsFolder.Name = "Pickups"
        pickupsFolder.Parent = plot
    end

    for idx, purchase in ipairs(PURCHASES) do
        local button = plot:FindFirstChild("Button_" .. purchase.id)
        if not button then
            button = Instance.new("Part")
            button.Name = "Button_" .. purchase.id
            button.Anchored = true
            button.CanCollide = true
            button.Material = Enum.Material.Neon
            button.Color = purchase.color
            button.Size = Vector3.new(12, 1.5, 12)
            button.Parent = plot

            local billboard = Instance.new("BillboardGui")
            billboard.Name = "CostBillboard"
            billboard.Size = UDim2.new(0, 200, 0, 56)
            billboard.StudsOffset = Vector3.new(0, 3.5, 0)
            billboard.AlwaysOnTop = true
            billboard.Parent = button
            makeLabel(billboard, string.format("%s - $%d", purchase.name, purchase.cost), Color3.fromRGB(255, 255, 255))
        end

        button.Position = basePos + Vector3.new(-45 + (idx - 1) * 14, 1.6, 42)
        local prompt = setPartPrompt(button, "BuyPrompt", "Buy", string.format("%s ($%d)", purchase.name, purchase.cost))

        local build = plot:FindFirstChild("Build_" .. purchase.id)
        if not build then
            build = Instance.new("Part")
            build.Name = "Build_" .. purchase.id
            build.Anchored = true
            build.CanCollide = false
            build.Transparency = 1
            build.Material = Enum.Material.SmoothPlastic
            build.Color = purchase.color:Lerp(Color3.fromRGB(255, 255, 255), 0.2)
            build.Size = Vector3.new(8, 8 + idx * 2, 8)
            build.Parent = plot
        end
        build.Position = basePos + Vector3.new(-45 + (idx - 1) * 14, 4 + idx, 18)

        prompt:SetAttribute("PurchaseId", purchase.id)
    end

    return plot
end

for i = 1, PLOT_COUNT do
    ensurePlot(i)
end

local function getMoneyValue(player)
    local ls = player:FindFirstChild("leaderstats")
    if not ls then
        return nil
    end
    return ls:FindFirstChild("Money")
end

local function getRebirthValue(player)
    local ls = player:FindFirstChild("leaderstats")
    if not ls then
        return nil
    end
    return ls:FindFirstChild("Rebirths")
end

local function markDirty(data)
    if data then
        data.dirty = true
    end
end

local function savePlayerData(player, reason)
    local data = playerData[player]
    if not data then
        return false
    end
    if data.isSaving then
        return false
    end
    if not data.dirty and reason ~= "shutdown" and reason ~= "leaving" then
        return false
    end

    data.isSaving = true
    local payload = buildSavePayload(player, data)
    local key = datastoreKey(player.UserId)

    local success = false
    for _ = 1, 3 do
        local ok = pcall(function()
            playerStore:SetAsync(key, payload)
        end)
        if ok then
            success = true
            break
        end
        task.wait(0.4)
    end

    data.isSaving = false
    if success then
        data.dirty = false
        data.lastSaveAt = os.clock()
    end
    return success
end

local function getRebirthCost(data)
    local stage = getStage(data)
    return math.floor(REBIRTH_BASE_COST * (data.rebirths + 1) * (1 + ((stage - 1) * 0.6)))
end

local function getPurchaseCost(data, purchase)
    local stage = getStage(data)
    return math.floor(purchase.cost * stageCostMultiplier(stage))
end

local function getStageProgress(data)
    local lifetime = math.max(0, math.floor(tonumber(data.lifetimeRebirths) or 0))
    local within = lifetime % REBIRTHS_PER_STAGE
    return within, REBIRTHS_PER_STAGE
end

local function getEventTimeLeft()
    return math.max(0, math.floor(currentEvent.endsAt - os.clock()))
end

local function getBuffTimeLeft(data)
    return math.max(0, math.floor(data.buff.expiresAt - os.clock()))
end

local function getItemBonuses(data)
    local flat = 0
    local mult = 0
    for itemId, equipped in pairs(data.equipped) do
        if equipped then
            local def = findItem(itemId)
            if def then
                flat += def.flatIncome
                mult += def.multBonus
            end
        end
    end
    return flat, mult
end

local function computeIncome(data)
    ensurePathState(data)
    local flat, multBonus = getItemBonuses(data)
    local pathDef = findPathDef(data.pathId)
    local pathIncomeMult = pathDef and pathDef.incomeMult or 1
    local stageMult = stageIncomeMultiplier(getStage(data))
    local buffMult = getBuffTimeLeft(data) > 0 and data.buff.moneyMult or 1
    local overdriveMult = os.clock() < (data.overdriveEndsAt or 0) and 2 or 1
    local gross = (data.baseIncome + flat) * (data.multiplier + multBonus) * buffMult * currentEvent.moneyMult * pathIncomeMult * stageMult * overdriveMult
    return math.max(0, math.floor(gross + 0.5))
end

local function itemsPayload(data)
    local list = {}
    for _, def in ipairs(ITEMS) do
        table.insert(list, {
            id = def.id,
            name = def.name,
            rarity = def.rarity,
            count = data.items[def.id] or 0,
            equipped = data.equipped[def.id] == true,
            flatIncome = def.flatIncome,
            multBonus = def.multBonus,
        })
    end
    return list
end

local function upgradesPayload(data)
    local list = {}
    for _, purchase in ipairs(PURCHASES) do
        table.insert(list, {
            id = purchase.id,
            name = purchase.name,
            cost = getPurchaseCost(data, purchase),
            income = purchase.income,
            bought = data.purchased[purchase.id] == true,
        })
    end
    return list
end

local function sendUI(player)
    local data = playerData[player]
    if not data then
        return
    end

    local money = getMoneyValue(player)
    if not money then
        return
    end

    ensureProgress(data)
    ensurePathState(data)
    local pathDef = findPathDef(data.pathId)
    local stage = getStage(data)
    local stageProgress, stageProgressMax = getStageProgress(data)
    local speedLevel = data.progress.speedLevel
    local jumpLevel = data.progress.jumpLevel
    local jetpackLevel = data.progress.jetpackLevel
    local now = os.clock()
    local jetpackCooldownNow = jetpackCooldown(jetpackLevel) * (pathDef and pathDef.jetpackCooldownMult or 1)
    local jetpackReady = math.max(0, jetpackCooldownNow - (now - (data.lastJetpackAt or 0)))
    local pathAbilityReadyIn = math.max(0, (data.pathAbilityReadyAt or 0) - now)
    local overdriveTimeLeft = math.max(0, math.floor((data.overdriveEndsAt or 0) - now))

    uiUpdateRemote:FireClient(player, {
        money = money.Value,
        income = computeIncome(data),
        baseIncome = data.baseIncome,
        multiplier = data.multiplier,
        rebirths = data.rebirths,
        rebirthCost = getRebirthCost(data),
        stage = stage,
        stageMax = MAX_STAGE,
        stageIncomeMult = stageIncomeMultiplier(stage),
        lifetimeRebirths = data.lifetimeRebirths,
        stageProgress = stageProgress,
        stageProgressMax = stageProgressMax,
        shards = data.shards,
        relics = data.relics,
        plot = data.plot and data.plot.Name or "None",
        eventName = currentEvent.name,
        eventTimeLeft = getEventTimeLeft(),
        buffName = getBuffTimeLeft(data) > 0 and data.buff.name or "None",
        buffTimeLeft = getBuffTimeLeft(data),
        speedLevel = speedLevel,
        jumpLevel = jumpLevel,
        jetpackLevel = jetpackLevel,
        speedCost = speedLevel < MAX_SPEED_LEVEL and math.floor(speedUpgradeCost(speedLevel) * (1 + ((stage - 1) * 0.22))) or 0,
        jumpCost = jumpLevel < MAX_JUMP_LEVEL and math.floor(jumpUpgradeCost(jumpLevel) * (1 + ((stage - 1) * 0.24))) or 0,
        jetpackCost = jetpackLevel < MAX_JETPACK_LEVEL and math.floor(jetpackUpgradeCost(jetpackLevel) * (1 + ((stage - 1) * 0.28))) or 0,
        jetpackReadyIn = jetpackReady,
        jetpackUnlocked = jetpackLevel > 0,
        pathId = pathDef and pathDef.id or "",
        pathName = pathDef and pathDef.name or "Unchosen",
        pathAbilityName = pathDef and pathDef.abilityName or "No Ability",
        pathChosen = pathDef ~= nil,
        pathAbilityReadyIn = pathAbilityReadyIn,
        pathSelectable = data.rebirths >= 1 and pathDef == nil,
        overdriveTimeLeft = overdriveTimeLeft,
        upgrades = upgradesPayload(data),
        items = itemsPayload(data),
    })
end

local function notify(player, text, kind)
    notifyRemote:FireClient(player, {
        text = text,
        kind = kind or "info",
    })
end

local function notifyAll(text, kind)
    for _, player in ipairs(Players:GetPlayers()) do
        notify(player, text, kind)
    end
end

local function setClaimVisual(plot, text, color)
    local claimPad = plot:FindFirstChild("ClaimPad")
    if not claimPad then
        return
    end
    claimPad.Color = color
    local bb = claimPad:FindFirstChild("ClaimBillboard")
    if bb then
        local label = bb:FindFirstChildOfClass("TextLabel")
        if label then
            label.Text = text
        end
    end
end

local function setUpgradeVisual(plot, purchaseId, owned)
    local button = plot:FindFirstChild("Button_" .. purchaseId)
    local build = plot:FindFirstChild("Build_" .. purchaseId)
    if button then
        button.Transparency = owned and 0.82 or 0
        button.CanCollide = not owned
        local prompt = button:FindFirstChild("BuyPrompt")
        if prompt then
            prompt.Enabled = not owned
        end
        local bb = button:FindFirstChild("CostBillboard")
        if bb then
            bb.Enabled = not owned
        end
    end
    if build then
        build.Transparency = owned and 0 or 1
        build.CanCollide = owned
    end
end

local function clearPickupsForData(data)
    if not data then
        return
    end
    for part in pairs(data.pickups) do
        if part and part.Parent then
            part:Destroy()
        end
    end
    data.pickups = {}
end

local function resetPlot(plot)
    plot:SetAttribute("OwnerUserId", 0)
    setClaimVisual(plot, "UNCLAIMED", Color3.fromRGB(50, 205, 50))
    for _, purchase in ipairs(PURCHASES) do
        setUpgradeVisual(plot, purchase.id, false)
    end
    local pickupsFolder = plot:FindFirstChild("Pickups")
    if pickupsFolder then
        pickupsFolder:ClearAllChildren()
    end
end

local function randomItemId()
    local total = 0
    for _, def in ipairs(ITEMS) do
        total += def.weight
    end
    local roll = math.random(1, total)
    local c = 0
    for _, def in ipairs(ITEMS) do
        c += def.weight
        if roll <= c then
            return def.id
        end
    end
    return ITEMS[1].id
end

local function randomPickupDef()
    local total = 0
    for _, def in ipairs(PICKUP_DEFS) do
        total += def.weight
    end
    local roll = math.random(1, total)
    local c = 0
    for _, def in ipairs(PICKUP_DEFS) do
        c += def.weight
        if roll <= c then
            return def
        end
    end
    return PICKUP_DEFS[1]
end

local function applyPickupReward(player, data, pickupId, source)
    local pickupDef = findPickupDef(pickupId)
    if not pickupDef then
        return false
    end
    pickupDef.apply(player, data)
    markDirty(data)
    notify(player, string.format("%s: %s", source or "Collected", pickupDef.name), "success")
    return true
end

local function grantItem(player, data, itemId, sourceText)
    data.items[itemId] = (data.items[itemId] or 0) + 1
    markDirty(data)
    local def = findItem(itemId)
    notify(player, string.format("%s drop: %s", sourceText, def and def.name or itemId), "success")
end

local function countEquipped(data)
    local c = 0
    for _, v in pairs(data.equipped) do
        if v then
            c += 1
        end
    end
    return c
end

local function tryEquipItem(player, data, itemId)
    if (data.items[itemId] or 0) <= 0 then
        notify(player, "You do not own that item.", "error")
        return
    end
    if data.equipped[itemId] then
        data.equipped[itemId] = nil
        markDirty(data)
        notify(player, "Item unequipped.", "info")
        sendUI(player)
        return
    end
    if countEquipped(data) >= MAX_EQUIPPED_ITEMS then
        notify(player, "Unequip an item first (max 2).", "error")
        return
    end
    data.equipped[itemId] = true
    markDirty(data)
    notify(player, "Item equipped.", "success")
    sendUI(player)
end

local function getLuckBonus(data)
    ensurePathState(data)
    local pathDef = findPathDef(data.pathId)
    local pathLuck = pathDef and pathDef.luckBonus or 0
    local buffLuck = getBuffTimeLeft(data) > 0 and data.buff.luckBonus or 0
    return currentEvent.luckBonus + buffLuck + pathLuck
end

local function pathAbilityCooldown(data)
    local pathDef = findPathDef(data.pathId)
    if not pathDef then
        return 0
    end
    return pathDef.abilityCooldown
end

local function tryOpenCrate(player, data)
    local crateCost = math.floor(50 * (1 + ((getStage(data) - 1) * 0.18)))
    if data.shards < crateCost then
        notify(player, string.format("Need %d shards for a crate.", crateCost), "error")
        return
    end
    data.shards -= crateCost
    markDirty(data)
    grantItem(player, data, randomItemId(), "Crate")

    local bonusChance = math.clamp(0.08 + getLuckBonus(data), 0, 0.65)
    if math.random() < bonusChance then
        grantItem(player, data, randomItemId(), "Crate Bonus")
    end

    sendUI(player)
end

local function doHarvest(player, data)
    ensurePathState(data)
    local now = os.clock()
    if now - data.lastHarvest < 1.25 then
        notify(player, "Node cooling down...", "error")
        return
    end
    data.lastHarvest = now

    local moneyVal = getMoneyValue(player)
    if not moneyVal then
        return
    end

    local buffMult = getBuffTimeLeft(data) > 0 and data.buff.moneyMult or 1
    local pathDef = findPathDef(data.pathId)
    local pathShardMult = pathDef and pathDef.shardMult or 1
    local stageMult = stageIncomeMultiplier(getStage(data))
    local gain = math.floor(math.random(15, 35) * data.multiplier * buffMult * currentEvent.moneyMult * stageMult)
    local shardGain = math.floor(math.random(4, 9) * currentEvent.shardMult * pathShardMult * (1 + ((getStage(data) - 1) * 0.08)))

    moneyVal.Value += gain
    data.shards += shardGain
    markDirty(data)

    local dropChance = math.clamp(0.22 + getLuckBonus(data), 0.05, 0.85)
    if math.random() < dropChance then
        grantItem(player, data, randomItemId(), "Harvest")
    end

    local relicChance = math.clamp(0.015 + (currentEvent.relicBonus or 0), 0, 0.22)
    if math.random() < relicChance then
        data.relics += 1
        notify(player, "You discovered an Ancient Relic.", "success")
    end

    notify(player, string.format("Harvested +$%d and +%d shards", gain, shardGain), "success")
    sendUI(player)
end

local function doRebirth(player, data)
    local moneyVal = getMoneyValue(player)
    local rebirthVal = getRebirthValue(player)
    if not moneyVal or not rebirthVal then
        return
    end

    local cost = getRebirthCost(data)
    if moneyVal.Value < cost then
        notify(player, string.format("Need $%d for rebirth.", cost), "error")
        return
    end

    local prevStage = getStage(data)
    moneyVal.Value = START_MONEY
    data.baseIncome = 0
    data.purchased = {}
    data.rebirths += 1
    data.lifetimeRebirths = (data.lifetimeRebirths or 0) + 1
    data.stage = computeStageFromLifetimeRebirths(data.lifetimeRebirths)
    data.multiplier = 1 + (data.rebirths * 0.25)
    data.pathId = nil
    data.pathAbilityReadyAt = 0
    data.overdriveEndsAt = 0
    data.overdriveNotified = false
    markDirty(data)
    rebirthVal.Value = data.rebirths

    if data.plot then
        for _, p in ipairs(PURCHASES) do
            setUpgradeVisual(data.plot, p.id, false)
        end
    end

    notify(player, string.format("Rebirth success! Multiplier is now x%.2f", data.multiplier), "success")
    if data.stage > prevStage then
        notify(player, string.format("Stage Up! You reached Stage %d.", data.stage), "success")
    end
    sendUI(player)
end

local function tryUpgradeSpeed(player, data)
    ensureProgress(data)
    local stage = getStage(data)
    if data.progress.speedLevel >= MAX_SPEED_LEVEL then
        notify(player, "Speed is maxed.", "info")
        return
    end
    local cost = math.floor(speedUpgradeCost(data.progress.speedLevel) * (1 + ((stage - 1) * 0.22)))
    if data.shards < cost then
        notify(player, string.format("Need %d shards for speed upgrade.", cost), "error")
        return
    end
    data.shards -= cost
    data.progress.speedLevel += 1
    markDirty(data)
    applyCharacterStats(player, data)
    notify(player, string.format("Speed upgraded to Lv.%d", data.progress.speedLevel), "success")
    sendUI(player)
end

local function tryUpgradeJump(player, data)
    ensureProgress(data)
    local stage = getStage(data)
    if data.progress.jumpLevel >= MAX_JUMP_LEVEL then
        notify(player, "Jump is maxed.", "info")
        return
    end
    local cost = math.floor(jumpUpgradeCost(data.progress.jumpLevel) * (1 + ((stage - 1) * 0.24)))
    if data.shards < cost then
        notify(player, string.format("Need %d shards for jump upgrade.", cost), "error")
        return
    end
    data.shards -= cost
    data.progress.jumpLevel += 1
    markDirty(data)
    applyCharacterStats(player, data)
    notify(player, string.format("Jump upgraded to Lv.%d", data.progress.jumpLevel), "success")
    sendUI(player)
end

local function tryUpgradeJetpack(player, data)
    ensureProgress(data)
    local stage = getStage(data)
    if data.progress.jetpackLevel >= MAX_JETPACK_LEVEL then
        notify(player, "Jetpack is maxed.", "info")
        return
    end
    if data.rebirths < 1 then
        notify(player, "Rebirth once to unlock jetpack progression.", "error")
        return
    end
    local gate = math.floor((data.progress.jetpackLevel + 1) * 2)
    if data.progress.speedLevel < gate or data.progress.jumpLevel < gate then
        notify(player, string.format("Need Speed/Jump Lv.%d for next jetpack tier.", gate), "error")
        return
    end
    local cost = math.floor(jetpackUpgradeCost(data.progress.jetpackLevel) * (1 + ((stage - 1) * 0.28)))
    if data.shards < cost then
        notify(player, string.format("Need %d shards for jetpack tier.", cost), "error")
        return
    end
    data.shards -= cost
    data.progress.jetpackLevel += 1
    markDirty(data)
    notify(player, string.format("Jetpack tier unlocked: Lv.%d", data.progress.jetpackLevel), "success")
    sendUI(player)
end

local function tryJetpackBurst(player, data)
    ensureProgress(data)
    ensurePathState(data)
    local level = data.progress.jetpackLevel
    if level <= 0 then
        notify(player, "Unlock jetpack tiers first.", "error")
        return
    end

    local now = os.clock()
    local pathDef = findPathDef(data.pathId)
    local cooldown = jetpackCooldown(level) * (pathDef and pathDef.jetpackCooldownMult or 1)
    if now - data.lastJetpackAt < cooldown then
        notify(player, string.format("Jetpack cooling down (%.1fs).", cooldown - (now - data.lastJetpackAt)), "error")
        return
    end

    local character = player.Character
    if not character then
        return
    end
    local root = character:FindFirstChild("HumanoidRootPart")
    if not root then
        return
    end

    local up = 78 + (level * 9)
    local forward = 18 + (level * 4)
    local look = root.CFrame.LookVector
    root.AssemblyLinearVelocity = Vector3.new(look.X * forward, up, look.Z * forward)

    data.lastJetpackAt = now
    markDirty(data)
    sendUI(player)
end

local function tryChoosePath(player, data, pathId)
    ensurePathState(data)
    if data.pathId then
        notify(player, "Path already selected for this rebirth lifecycle.", "error")
        return
    end
    if data.rebirths < 1 then
        notify(player, "Rebirth once to unlock paths.", "error")
        return
    end
    local pathDef = findPathDef(pathId)
    if not pathDef then
        notify(player, "Unknown path selection.", "error")
        return
    end
    data.pathId = pathDef.id
    data.pathAbilityReadyAt = 0
    markDirty(data)
    applyCharacterStats(player, data)
    notify(player, string.format("Path selected: %s", pathDef.name), "success")
    sendUI(player)
end

local function tryUsePathAbility(player, data)
    ensurePathState(data)
    local pathDef = findPathDef(data.pathId)
    if not pathDef then
        notify(player, "Select a path first.", "error")
        return
    end

    local now = os.clock()
    if now < (data.pathAbilityReadyAt or 0) then
        notify(player, string.format("%s cooling down (%.1fs).", pathDef.abilityName, data.pathAbilityReadyAt - now), "error")
        return
    end

    if pathDef.id == "industrialist" then
        data.overdriveEndsAt = now + 18
        data.overdriveNotified = false
        notify(player, "Overdrive active for 18s (2x income).", "success")
    elseif pathDef.id == "explorer" then
        local collected = 0
        for pickup in pairs(data.pickups) do
            if pickup and pickup.Parent then
                local pickupId = string.gsub(pickup.Name, "^Pickup_", "")
                if applyPickupReward(player, data, pickupId, "Magnet Sweep") then
                    collected += 1
                end
                pickup:Destroy()
            end
            data.pickups[pickup] = nil
        end
        if collected == 0 then
            notify(player, "Magnet Sweep used, but no pickups were active.", "info")
        else
            notify(player, string.format("Magnet Sweep collected %d pickup(s).", collected), "success")
        end
    elseif pathDef.id == "aerialist" then
        data.lastJetpackAt = 0
        local character = player.Character
        local root = character and character:FindFirstChild("HumanoidRootPart")
        if root then
            local look = root.CFrame.LookVector
            root.AssemblyLinearVelocity = Vector3.new(look.X * 44, 118, look.Z * 44)
        end
        notify(player, "Sky Surge launched you and refreshed jetpack timing.", "success")
    end

    data.pathAbilityReadyAt = now + pathAbilityCooldown(data)
    markDirty(data)
    sendUI(player)
end

local function assignPlot(player)
    for _, plot in ipairs(world:GetChildren()) do
        if plot:IsA("Model") and (plot:GetAttribute("OwnerUserId") or 0) == 0 then
            plot:SetAttribute("OwnerUserId", player.UserId)
            setClaimVisual(plot, player.Name .. "'s TYCOON", Color3.fromRGB(255, 170, 0))
            for _, p in ipairs(PURCHASES) do
                setUpgradeVisual(plot, p.id, false)
            end
            return plot
        end
    end
    return nil
end

local function spawnPickupForPlayer(player, data)
    if not data.plot then
        return
    end
    if next(data.pickups) ~= nil then
        local count = 0
        for _ in pairs(data.pickups) do
            count += 1
        end
        if count >= PICKUP_MAX_PER_PLOT then
            return
        end
    end

    local pickupsFolder = data.plot:FindFirstChild("Pickups")
    local base = data.plot:FindFirstChild("Base")
    if not pickupsFolder or not base then
        return
    end

    local def = randomPickupDef()
    local pickup = Instance.new("Part")
    pickup.Name = "Pickup_" .. def.id
    pickup.Shape = Enum.PartType.Ball
    pickup.Size = Vector3.new(3.5, 3.5, 3.5)
    pickup.Material = Enum.Material.Neon
    pickup.Color = def.color
    pickup.Anchored = true
    pickup.CanCollide = false

    local x = math.random(-42, 42)
    local z = math.random(-42, 42)
    pickup.Position = base.Position + Vector3.new(x, 3.4, z)
    pickup.Parent = pickupsFolder

    local prompt = setPartPrompt(pickup, "CollectPrompt", "Collect", def.name)
    prompt.MaxActivationDistance = 14

    data.pickups[pickup] = true

    prompt.Triggered:Connect(function(triggeringPlayer)
        if triggeringPlayer ~= player then
            return
        end
        if not playerData[player] then
            return
        end

        local pickupData = playerData[player]
        if pickupData.plot ~= data.plot then
            return
        end

        applyPickupReward(player, pickupData, def.id, "Collected")

        if pickup and pickup.Parent then
            pickup:Destroy()
        end
        pickupData.pickups[pickup] = nil
        sendUI(player)
    end)

    task.delay(math.random(22, 34), function()
        if pickup and pickup.Parent then
            pickup:Destroy()
        end
        if playerData[player] then
            playerData[player].pickups[pickup] = nil
        end
    end)
end

local function hookPlotPrompts(player)
    local data = playerData[player]
    if not data or not data.plot then
        return
    end

    local plot = data.plot

    for _, p in ipairs(PURCHASES) do
        local button = plot:FindFirstChild("Button_" .. p.id)
        local prompt = button and button:FindFirstChild("BuyPrompt")
        if prompt then
            prompt.Triggered:Connect(function(triggeringPlayer)
                if triggeringPlayer ~= player then
                    return
                end
                if data.purchased[p.id] then
                    return
                end
                local moneyVal = getMoneyValue(player)
                if not moneyVal then
                    return
                end
                local purchaseCost = getPurchaseCost(data, p)
                if moneyVal.Value < purchaseCost then
                    notify(player, string.format("Need $%d more for %s", purchaseCost - moneyVal.Value, p.name), "error")
                    return
                end
                moneyVal.Value -= purchaseCost
                data.purchased[p.id] = true
                data.baseIncome += p.income
                markDirty(data)
                setUpgradeVisual(plot, p.id, true)
                notify(player, string.format("Unlocked %s (+$%d/s base)", p.name, p.income), "success")
                sendUI(player)
            end)
        end
    end

    local harvestPrompt = plot:FindFirstChild("SimulatorPad") and plot.SimulatorPad:FindFirstChild("HarvestPrompt")
    if harvestPrompt then
        harvestPrompt.Triggered:Connect(function(triggeringPlayer)
            if triggeringPlayer == player then
                doHarvest(player, data)
            end
        end)
    end

    local cratePrompt = plot:FindFirstChild("CratePad") and plot.CratePad:FindFirstChild("CratePrompt")
    if cratePrompt then
        cratePrompt.Triggered:Connect(function(triggeringPlayer)
            if triggeringPlayer == player then
                tryOpenCrate(player, data)
            end
        end)
    end

    local rebirthPrompt = plot:FindFirstChild("RebirthPad") and plot.RebirthPad:FindFirstChild("RebirthPrompt")
    if rebirthPrompt then
        rebirthPrompt.Triggered:Connect(function(triggeringPlayer)
            if triggeringPlayer == player then
                doRebirth(player, data)
            end
        end)
    end
end

local function setupLeaderstats(player)
    local ls = player:FindFirstChild("leaderstats")
    if not ls then
        ls = Instance.new("Folder")
        ls.Name = "leaderstats"
        ls.Parent = player
    end

    local money = ls:FindFirstChild("Money")
    if not money then
        money = Instance.new("IntValue")
        money.Name = "Money"
        money.Value = START_MONEY
        money.Parent = ls
    end

    local rebirths = ls:FindFirstChild("Rebirths")
    if not rebirths then
        rebirths = Instance.new("IntValue")
        rebirths.Name = "Rebirths"
        rebirths.Value = 0
        rebirths.Parent = ls
    end

    if not money:GetAttribute("TycoonMoneyHooked") then
        money:SetAttribute("TycoonMoneyHooked", true)
        money.Changed:Connect(function()
            sendUI(player)
        end)
    end
end

actionRemote.OnServerEvent:Connect(function(player, action, payload)
    local data = playerData[player]
    if not data then
        return
    end

    if action == "rebirth" then
        doRebirth(player, data)
    elseif action == "open_crate" then
        tryOpenCrate(player, data)
    elseif action == "harvest" then
        doHarvest(player, data)
    elseif action == "upgrade_speed" then
        tryUpgradeSpeed(player, data)
    elseif action == "upgrade_jump" then
        tryUpgradeJump(player, data)
    elseif action == "upgrade_jetpack" then
        tryUpgradeJetpack(player, data)
    elseif action == "jetpack" then
        tryJetpackBurst(player, data)
    elseif action == "choose_path" then
        local pathId = type(payload) == "table" and payload.pathId or nil
        if type(pathId) == "string" then
            tryChoosePath(player, data, pathId)
        end
    elseif action == "path_ability" then
        tryUsePathAbility(player, data)
    elseif action == "toggle_equip" then
        local itemId = type(payload) == "table" and payload.itemId or nil
        if type(itemId) == "string" then
            tryEquipItem(player, data, itemId)
        end
    end
end)

local function placeCharacterAtClaim(player, data)
    if not data or not data.plot then
        return
    end
    local character = player.Character
    if not character then
        return
    end
    local root = character:FindFirstChild("HumanoidRootPart")
    local claimPad = data.plot:FindFirstChild("ClaimPad")
    if root and claimPad then
        root.CFrame = claimPad.CFrame + Vector3.new(0, 5, 0)
    end
end

local function initializePlayer(player)
    setupLeaderstats(player)

    local loaded = loadPlayerSnapshot(player.UserId)
    local plot = assignPlot(player)
    local moneyVal = getMoneyValue(player)
    local rebirthVal = getRebirthValue(player)

    local loadedRebirths = loaded and math.max(0, math.floor(tonumber(loaded.rebirths) or 0)) or 0
    local loadedMoney = loaded and math.max(0, math.floor(tonumber(loaded.money) or START_MONEY)) or START_MONEY
    local loadedShards = loaded and math.max(0, math.floor(tonumber(loaded.shards) or 0)) or 0
    local loadedRelics = loaded and math.max(0, math.floor(tonumber(loaded.relics) or 0)) or 0
    local loadedLifetimeRebirths = loaded and math.max(0, math.floor(tonumber(loaded.lifetimeRebirths) or loadedRebirths)) or loadedRebirths
    local loadedStage = loaded and math.max(1, math.floor(tonumber(loaded.stage) or computeStageFromLifetimeRebirths(loadedLifetimeRebirths))) or computeStageFromLifetimeRebirths(loadedLifetimeRebirths)
    local loadedPathId = loaded and type(loaded.pathId) == "string" and loaded.pathId or nil
    local loadedPurchased = loaded and sanitizeOwnedMap(loaded.purchased, PURCHASES) or {}
    local loadedItems = loaded and sanitizeItemCounts(loaded.items) or {}
    local loadedEquipped = loaded and sanitizeOwnedMap(loaded.equipped, ITEMS) or {}

    for itemId, _ in pairs(loadedEquipped) do
        if (loadedItems[itemId] or 0) <= 0 then
            loadedEquipped[itemId] = nil
        end
    end
    local equipCount = 0
    for itemId, _ in pairs(loadedEquipped) do
        equipCount += 1
        if equipCount > MAX_EQUIPPED_ITEMS then
            loadedEquipped[itemId] = nil
        end
    end

    local progress = loaded and loaded.progress or nil

    if moneyVal then
        moneyVal.Value = loadedMoney
    end
    if rebirthVal then
        rebirthVal.Value = loadedRebirths
    end

    playerData[player] = {
        plot = plot,
        purchased = loadedPurchased,
        baseIncome = computeBaseIncomeFromPurchases(loadedPurchased),
        shards = loadedShards,
        relics = loadedRelics,
        stage = loadedStage,
        lifetimeRebirths = loadedLifetimeRebirths,
        items = loadedItems,
        equipped = loadedEquipped,
        rebirths = loadedRebirths,
        multiplier = 1 + (loadedRebirths * 0.25),
        lastHarvest = 0,
        nextPickupAt = os.clock() + math.random(7, 14),
        pickups = {},
        buff = {
            name = "None",
            moneyMult = 1,
            luckBonus = 0,
            expiresAt = 0,
        },
        progress = {
            speedLevel = progress and progress.speedLevel or 0,
            jumpLevel = progress and progress.jumpLevel or 0,
            jetpackLevel = progress and progress.jetpackLevel or 0,
        },
        lastJetpackAt = 0,
        pathId = loadedPathId,
        pathAbilityReadyAt = 0,
        overdriveEndsAt = 0,
        overdriveNotified = false,
        dirty = false,
        isSaving = false,
        lastSaveAt = 0,
    }
    ensureProgress(playerData[player])
    ensurePathState(playerData[player])

    if not plot then
        notify(player, "All plots are occupied. Waiting for a free one.", "error")
        sendUI(player)
        return
    end

    hookPlotPrompts(player)
    for _, purchase in ipairs(PURCHASES) do
        setUpgradeVisual(plot, purchase.id, playerData[player].purchased[purchase.id] == true)
    end

    player.CharacterAdded:Connect(function()
        task.wait(0.15)
        local d = playerData[player]
        if d then
            applyCharacterStats(player, d)
            placeCharacterAtClaim(player, d)
            sendUI(player)
        end
    end)

    if player.Character then
        applyCharacterStats(player, playerData[player])
        placeCharacterAtClaim(player, playerData[player])
    end

    notify(player, "Tycoon loaded. Progression and saves are active.", "info")
    sendUI(player)
end

Players.PlayerAdded:Connect(initializePlayer)

Players.PlayerRemoving:Connect(function(player)
    local data = playerData[player]
    if data then
        savePlayerData(player, "leaving")
        clearPickupsForData(data)
        if data.plot then
            resetPlot(data.plot)
        end
    end
    playerData[player] = nil
end)

task.spawn(function()
    while true do
        task.wait(1)
        for player, data in pairs(playerData) do
            ensurePathState(data)
            local moneyVal = getMoneyValue(player)
            if moneyVal then
                local inc = computeIncome(data)
                if inc > 0 then
                    moneyVal.Value += inc
                    markDirty(data)
                end
            end

            if getBuffTimeLeft(data) <= 0 and data.buff.name ~= "None" then
                data.buff.name = "None"
                data.buff.moneyMult = 1
                data.buff.luckBonus = 0
                data.buff.expiresAt = 0
                notify(player, "Potion buff expired.", "info")
            end

            if data.overdriveEndsAt > 0 and os.clock() >= data.overdriveEndsAt then
                if not data.overdriveNotified then
                    notify(player, "Overdrive has ended.", "info")
                    data.overdriveNotified = true
                end
                data.overdriveEndsAt = 0
            end

            if data.plot and os.clock() >= data.nextPickupAt then
                spawnPickupForPlayer(player, data)
                local pathDef = findPathDef(data.pathId)
                local explorerBoost = (pathDef and pathDef.id == "explorer") and 0.75 or 1
                data.nextPickupAt = os.clock() + (math.random(12, 22) * explorerBoost)
            end

            if os.clock() - (data.lastSaveAt or 0) >= AUTOSAVE_SECONDS then
                savePlayerData(player, "autosave")
            end

            sendUI(player)
        end
    end
end)

task.spawn(function()
    while true do
        task.wait(30)

        local now = os.clock()
        if now < currentEvent.endsAt then
            continue
        end

        local nextDef = EVENTS[math.random(2, #EVENTS)]
        currentEvent.id = nextDef.id
        currentEvent.name = nextDef.name
        currentEvent.moneyMult = nextDef.moneyMult
        currentEvent.shardMult = nextDef.shardMult
        currentEvent.luckBonus = nextDef.luckBonus
        currentEvent.jumpBonus = nextDef.jumpBonus or 0
        currentEvent.relicBonus = nextDef.relicBonus or 0
        currentEvent.endsAt = os.clock() + 45

        for player, data in pairs(playerData) do
            applyCharacterStats(player, data)
        end

        notifyAll(
            string.format("World Event: %s (%.0fs)", currentEvent.name, currentEvent.endsAt - os.clock()),
            "info"
        )

        task.delay(45, function()
            currentEvent.id = "none"
            currentEvent.name = "None"
            currentEvent.moneyMult = 1
            currentEvent.shardMult = 1
            currentEvent.luckBonus = 0
            currentEvent.jumpBonus = 0
            currentEvent.relicBonus = 0
            currentEvent.endsAt = 0
            for player, data in pairs(playerData) do
                applyCharacterStats(player, data)
            end
            notifyAll("World Event ended.", "info")
        end)
    end
end)

for _, player in ipairs(Players:GetPlayers()) do
    task.defer(initializePlayer, player)
end

game:BindToClose(function()
    if RunService:IsStudio() then
        task.wait(0.25)
    end
    for _, player in ipairs(Players:GetPlayers()) do
        savePlayerData(player, "shutdown")
    end
    task.wait(0.35)
end)
