local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local remotes = ReplicatedStorage:WaitForChild("TycoonRemotes")
local uiUpdateRemote = remotes:WaitForChild("TycoonUIUpdate")
local notifyRemote = remotes:WaitForChild("TycoonNotify")
local actionRemote = remotes:WaitForChild("TycoonAction")
local NL = string.char(10)

local function formatMoney(value)
    local sign = value < 0 and "-" or ""
    value = math.abs(value)
    if value >= 1_000_000 then
        return string.format("%s$%.1fM", sign, value / 1_000_000)
    end
    if value >= 1_000 then
        return string.format("%s$%.1fK", sign, value / 1_000)
    end
    return sign .. "$" .. tostring(math.floor(value))
end

local function rarityColor(rarity)
    if rarity == "Legendary" then
        return Color3.fromRGB(255, 186, 73)
    elseif rarity == "Rare" then
        return Color3.fromRGB(132, 178, 255)
    elseif rarity == "Uncommon" then
        return Color3.fromRGB(120, 238, 143)
    end
    return Color3.fromRGB(188, 196, 214)
end

local gui = Instance.new("ScreenGui")
gui.Name = "TycoonHUD"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.Parent = player:WaitForChild("PlayerGui")

local root = Instance.new("Frame")
root.Size = UDim2.fromScale(1, 1)
root.BackgroundTransparency = 1
root.Parent = gui

local moneyCard = Instance.new("Frame")
moneyCard.Position = UDim2.new(0, 20, 0, 16)
moneyCard.Size = UDim2.new(0, 330, 0, 104)
moneyCard.BackgroundColor3 = Color3.fromRGB(16, 23, 34)
moneyCard.Parent = root
Instance.new("UICorner", moneyCard).CornerRadius = UDim.new(0, 16)
local moneyStroke = Instance.new("UIStroke", moneyCard)
moneyStroke.Color = Color3.fromRGB(88, 173, 255)
moneyStroke.Transparency = 0.25
moneyStroke.Thickness = 2

local moneyTitle = Instance.new("TextLabel")
moneyTitle.BackgroundTransparency = 1
moneyTitle.Position = UDim2.new(0, 14, 0, 8)
moneyTitle.Size = UDim2.new(1, -28, 0, 22)
moneyTitle.Font = Enum.Font.GothamSemibold
moneyTitle.TextXAlignment = Enum.TextXAlignment.Left
moneyTitle.TextSize = 15
moneyTitle.TextColor3 = Color3.fromRGB(154, 190, 255)
moneyTitle.Text = "NOVA TYCOON SIM"
moneyTitle.Parent = moneyCard

local moneyLabel = Instance.new("TextLabel")
moneyLabel.BackgroundTransparency = 1
moneyLabel.Position = UDim2.new(0, 14, 0, 26)
moneyLabel.Size = UDim2.new(1, -28, 0, 44)
moneyLabel.Font = Enum.Font.GothamBlack
moneyLabel.TextXAlignment = Enum.TextXAlignment.Left
moneyLabel.TextSize = 38
moneyLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
moneyLabel.Text = "$0"
moneyLabel.Parent = moneyCard

local incomeLabel = Instance.new("TextLabel")
incomeLabel.BackgroundTransparency = 1
incomeLabel.Position = UDim2.new(0, 14, 1, -24)
incomeLabel.Size = UDim2.new(1, -28, 0, 18)
incomeLabel.Font = Enum.Font.GothamMedium
incomeLabel.TextXAlignment = Enum.TextXAlignment.Left
incomeLabel.TextSize = 14
incomeLabel.TextColor3 = Color3.fromRGB(111, 255, 163)
incomeLabel.Text = "+$0/s"
incomeLabel.Parent = moneyCard

local statCard = Instance.new("Frame")
statCard.Position = UDim2.new(0, 20, 0, 128)
statCard.Size = UDim2.new(0, 330, 0, 170)
statCard.BackgroundColor3 = Color3.fromRGB(20, 24, 36)
statCard.Parent = root
Instance.new("UICorner", statCard).CornerRadius = UDim.new(0, 14)
local statStroke = Instance.new("UIStroke", statCard)
statStroke.Color = Color3.fromRGB(133, 146, 181)
statStroke.Transparency = 0.35

local statText = Instance.new("TextLabel")
statText.BackgroundTransparency = 1
statText.Position = UDim2.new(0, 14, 0, 12)
statText.Size = UDim2.new(1, -28, 1, -24)
statText.Font = Enum.Font.GothamSemibold
statText.TextXAlignment = Enum.TextXAlignment.Left
statText.TextYAlignment = Enum.TextYAlignment.Top
statText.TextSize = 14
statText.TextColor3 = Color3.fromRGB(228, 235, 255)
statText.TextWrapped = true
statText.Text = "Plot: None" .. NL .. "Stage: 1/20" .. NL .. "Rebirths: 0" .. NL .. "Multiplier: x1.00" .. NL .. "Shards: 0" .. NL .. "Event: None" .. NL .. "Potion: None"
statText.Parent = statCard

local actionCard = Instance.new("Frame")
actionCard.Position = UDim2.new(0, 20, 0, 306)
actionCard.Size = UDim2.new(0, 330, 0, 258)
actionCard.BackgroundColor3 = Color3.fromRGB(17, 20, 31)
actionCard.Parent = root
Instance.new("UICorner", actionCard).CornerRadius = UDim.new(0, 14)
local actionStroke = Instance.new("UIStroke", actionCard)
actionStroke.Color = Color3.fromRGB(129, 143, 189)
actionStroke.Transparency = 0.35

local function makeActionButton(parent, text, pos, color)
    local b = Instance.new("TextButton")
    b.Size = UDim2.new(0, 148, 0, 40)
    b.Position = pos
    b.BackgroundColor3 = color
    b.Text = text
    b.TextColor3 = Color3.new(1, 1, 1)
    b.Font = Enum.Font.GothamBold
    b.TextSize = 14
    b.AutoButtonColor = true
    b.Parent = parent
    Instance.new("UICorner", b).CornerRadius = UDim.new(0, 10)
    return b
end

local harvestBtn = makeActionButton(actionCard, "Harvest", UDim2.new(0, 12, 0, 12), Color3.fromRGB(73, 129, 255))
local crateBtn = makeActionButton(actionCard, "Open Crate", UDim2.new(0, 170, 0, 12), Color3.fromRGB(255, 154, 84))
local rebirthBtn = makeActionButton(actionCard, "Rebirth", UDim2.new(0, 12, 0, 62), Color3.fromRGB(255, 97, 168))
local speedBtn = makeActionButton(actionCard, "Speed +", UDim2.new(0, 12, 0, 110), Color3.fromRGB(79, 174, 255))
local jumpBtn = makeActionButton(actionCard, "Jump +", UDim2.new(0, 170, 0, 110), Color3.fromRGB(105, 190, 145))
local rebirthCostText = Instance.new("TextLabel")
rebirthCostText.BackgroundTransparency = 1
rebirthCostText.Position = UDim2.new(0, 170, 0, 66)
rebirthCostText.Size = UDim2.new(0, 148, 0, 28)
rebirthCostText.Font = Enum.Font.GothamSemibold
rebirthCostText.TextSize = 13
rebirthCostText.TextColor3 = Color3.fromRGB(255, 214, 229)
rebirthCostText.Text = "Need: $0"
rebirthCostText.Parent = actionCard

local jetpackBtn = Instance.new("TextButton")
jetpackBtn.Size = UDim2.new(0, 306, 0, 34)
jetpackBtn.Position = UDim2.new(0, 12, 0, 142)
jetpackBtn.BackgroundColor3 = Color3.fromRGB(109, 111, 245)
jetpackBtn.Text = "Jetpack: Locked"
jetpackBtn.TextColor3 = Color3.new(1, 1, 1)
jetpackBtn.Font = Enum.Font.GothamBold
jetpackBtn.TextSize = 13
jetpackBtn.AutoButtonColor = true
jetpackBtn.Parent = actionCard
Instance.new("UICorner", jetpackBtn).CornerRadius = UDim.new(0, 10)

local pathBtn = Instance.new("TextButton")
pathBtn.Size = UDim2.new(0, 148, 0, 34)
pathBtn.Position = UDim2.new(0, 12, 0, 186)
pathBtn.BackgroundColor3 = Color3.fromRGB(95, 117, 255)
pathBtn.Text = "Choose Path"
pathBtn.TextColor3 = Color3.new(1, 1, 1)
pathBtn.Font = Enum.Font.GothamBold
pathBtn.TextSize = 12
pathBtn.AutoButtonColor = true
pathBtn.Parent = actionCard
Instance.new("UICorner", pathBtn).CornerRadius = UDim.new(0, 10)

local pathAbilityBtn = Instance.new("TextButton")
pathAbilityBtn.Size = UDim2.new(0, 148, 0, 34)
pathAbilityBtn.Position = UDim2.new(0, 170, 0, 186)
pathAbilityBtn.BackgroundColor3 = Color3.fromRGB(82, 169, 247)
pathAbilityBtn.Text = "Path Ability"
pathAbilityBtn.TextColor3 = Color3.new(1, 1, 1)
pathAbilityBtn.Font = Enum.Font.GothamBold
pathAbilityBtn.TextSize = 12
pathAbilityBtn.AutoButtonColor = true
pathAbilityBtn.Parent = actionCard
Instance.new("UICorner", pathAbilityBtn).CornerRadius = UDim.new(0, 10)

local relicLabel = Instance.new("TextLabel")
relicLabel.BackgroundTransparency = 1
relicLabel.Position = UDim2.new(0, 12, 0, 226)
relicLabel.Size = UDim2.new(1, -24, 0, 20)
relicLabel.Font = Enum.Font.GothamSemibold
relicLabel.TextSize = 13
relicLabel.TextColor3 = Color3.fromRGB(255, 178, 107)
relicLabel.TextXAlignment = Enum.TextXAlignment.Left
relicLabel.Text = "Relics: 0"
relicLabel.Parent = actionCard

local rightPanel = Instance.new("Frame")
rightPanel.AnchorPoint = Vector2.new(1, 1)
rightPanel.Position = UDim2.new(1, -20, 1, -20)
rightPanel.Size = UDim2.new(0, 380, 0, 520)
rightPanel.BackgroundColor3 = Color3.fromRGB(14, 17, 25)
rightPanel.Parent = root
Instance.new("UICorner", rightPanel).CornerRadius = UDim.new(0, 18)
local rightStroke = Instance.new("UIStroke", rightPanel)
rightStroke.Color = Color3.fromRGB(111, 126, 170)
rightStroke.Transparency = 0.35

local upgradesTitle = Instance.new("TextLabel")
upgradesTitle.BackgroundTransparency = 1
upgradesTitle.Position = UDim2.new(0, 12, 0, 8)
upgradesTitle.Size = UDim2.new(1, -24, 0, 28)
upgradesTitle.Font = Enum.Font.GothamBold
upgradesTitle.TextXAlignment = Enum.TextXAlignment.Left
upgradesTitle.TextSize = 18
upgradesTitle.TextColor3 = Color3.fromRGB(236, 241, 255)
upgradesTitle.Text = "Upgrades"
upgradesTitle.Parent = rightPanel

local upgradesScroll = Instance.new("ScrollingFrame")
upgradesScroll.Position = UDim2.new(0, 10, 0, 36)
upgradesScroll.Size = UDim2.new(1, -20, 0, 210)
upgradesScroll.BackgroundTransparency = 1
upgradesScroll.ScrollBarThickness = 4
upgradesScroll.CanvasSize = UDim2.new(0, 0, 0, 0)
upgradesScroll.Parent = rightPanel
local upgradesLayout = Instance.new("UIListLayout", upgradesScroll)
upgradesLayout.Padding = UDim.new(0, 7)

local itemsTitle = Instance.new("TextLabel")
itemsTitle.BackgroundTransparency = 1
itemsTitle.Position = UDim2.new(0, 12, 0, 256)
itemsTitle.Size = UDim2.new(1, -24, 0, 28)
itemsTitle.Font = Enum.Font.GothamBold
itemsTitle.TextXAlignment = Enum.TextXAlignment.Left
itemsTitle.TextSize = 18
itemsTitle.TextColor3 = Color3.fromRGB(236, 241, 255)
itemsTitle.Text = "Items (Equip up to 2)"
itemsTitle.Parent = rightPanel

local itemsScroll = Instance.new("ScrollingFrame")
itemsScroll.Position = UDim2.new(0, 10, 0, 286)
itemsScroll.Size = UDim2.new(1, -20, 1, -296)
itemsScroll.BackgroundTransparency = 1
itemsScroll.ScrollBarThickness = 4
itemsScroll.CanvasSize = UDim2.new(0, 0, 0, 0)
itemsScroll.Parent = rightPanel
local itemsLayout = Instance.new("UIListLayout", itemsScroll)
itemsLayout.Padding = UDim.new(0, 7)

local toastHolder = Instance.new("Frame")
toastHolder.AnchorPoint = Vector2.new(0.5, 0)
toastHolder.Position = UDim2.new(0.5, 0, 0, 18)
toastHolder.Size = UDim2.new(0, 500, 0, 140)
toastHolder.BackgroundTransparency = 1
toastHolder.Parent = root
local toastLayout = Instance.new("UIListLayout", toastHolder)
toastLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center
toastLayout.Padding = UDim.new(0, 8)

local currentMoney = 0
local targetMoney = 0
local currentIncome = 0
local targetIncome = 0
local state = {
    plot = "None",
    rebirths = 0,
    multiplier = 1,
    shards = 0,
    rebirthCost = 0,
    eventName = "None",
    eventTimeLeft = 0,
    buffName = "None",
    buffTimeLeft = 0,
    speedLevel = 0,
    jumpLevel = 0,
    jetpackLevel = 0,
    speedCost = 0,
    jumpCost = 0,
    jetpackCost = 0,
    jetpackReadyIn = 0,
    jetpackUnlocked = false,
    relics = 0,
    pathId = "",
    pathName = "Unchosen",
    pathAbilityName = "No Ability",
    pathChosen = false,
    pathSelectable = false,
    pathAbilityReadyIn = 0,
    overdriveTimeLeft = 0,
    stage = 1,
    stageMax = 20,
    stageIncomeMult = 1,
    lifetimeRebirths = 0,
    stageProgress = 0,
    stageProgressMax = 3,
}

local function toastColor(kind)
    if kind == "success" then
        return Color3.fromRGB(24, 97, 62)
    elseif kind == "error" then
        return Color3.fromRGB(120, 43, 51)
    end
    return Color3.fromRGB(52, 72, 116)
end

local function showToast(text, kind)
    local toast = Instance.new("Frame")
    toast.Size = UDim2.new(0, 460, 0, 42)
    toast.BackgroundColor3 = toastColor(kind)
    toast.BackgroundTransparency = 0.2
    toast.Parent = toastHolder
    Instance.new("UICorner", toast).CornerRadius = UDim.new(0, 10)

    local label = Instance.new("TextLabel")
    label.BackgroundTransparency = 1
    label.Position = UDim2.new(0, 10, 0, 0)
    label.Size = UDim2.new(1, -20, 1, 0)
    label.Font = Enum.Font.GothamSemibold
    label.TextSize = 14
    label.TextXAlignment = Enum.TextXAlignment.Left
    label.TextColor3 = Color3.new(1, 1, 1)
    label.Text = text
    label.Parent = toast

    toast.Position = UDim2.new(0, 0, 0, -14)
    toast.BackgroundTransparency = 1
    TweenService:Create(toast, TweenInfo.new(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
        Position = UDim2.new(0, 0, 0, 0),
        BackgroundTransparency = 0.2,
    }):Play()

    task.delay(3.1, function()
        local t = TweenService:Create(toast, TweenInfo.new(0.25, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
            BackgroundTransparency = 1,
            Size = UDim2.new(0, 460, 0, 0),
        })
        t:Play()
        t.Completed:Wait()
        toast:Destroy()
    end)
end

local function clearRows(scroller)
    for _, c in ipairs(scroller:GetChildren()) do
        if c:IsA("Frame") then
            c:Destroy()
        end
    end
end

local function renderUpgrades(upgrades)
    clearRows(upgradesScroll)
    local total = 0
    for _, up in ipairs(upgrades or {}) do
        local row = Instance.new("Frame")
        row.Size = UDim2.new(1, 0, 0, 52)
        row.BackgroundColor3 = up.bought and Color3.fromRGB(26, 55, 39) or Color3.fromRGB(29, 33, 47)
        row.Parent = upgradesScroll
        Instance.new("UICorner", row).CornerRadius = UDim.new(0, 10)

        local name = Instance.new("TextLabel")
        name.BackgroundTransparency = 1
        name.Position = UDim2.new(0, 10, 0, 6)
        name.Size = UDim2.new(1, -130, 0, 20)
        name.Font = Enum.Font.GothamSemibold
        name.TextSize = 14
        name.TextXAlignment = Enum.TextXAlignment.Left
        name.TextColor3 = Color3.fromRGB(236, 242, 255)
        name.Text = up.name
        name.Parent = row

        local detail = Instance.new("TextLabel")
        detail.BackgroundTransparency = 1
        detail.Position = UDim2.new(0, 10, 0, 28)
        detail.Size = UDim2.new(1, -130, 0, 18)
        detail.Font = Enum.Font.GothamMedium
        detail.TextSize = 12
        detail.TextXAlignment = Enum.TextXAlignment.Left
        detail.TextColor3 = Color3.fromRGB(161, 178, 219)
        detail.Text = string.format("+%s/s", formatMoney(up.income):gsub("%$", ""))
        detail.Parent = row

        local tag = Instance.new("TextLabel")
        tag.BackgroundTransparency = 1
        tag.AnchorPoint = Vector2.new(1, 0.5)
        tag.Position = UDim2.new(1, -10, 0.5, 0)
        tag.Size = UDim2.new(0, 110, 0, 24)
        tag.Font = Enum.Font.GothamBold
        tag.TextSize = 12
        tag.Text = up.bought and "UNLOCKED" or formatMoney(up.cost)
        tag.TextColor3 = up.bought and Color3.fromRGB(110, 255, 168) or Color3.fromRGB(255, 218, 140)
        tag.Parent = row

        total += 59
    end
    upgradesScroll.CanvasSize = UDim2.new(0, 0, 0, math.max(total, 1))
end

local function renderItems(items)
    clearRows(itemsScroll)
    local total = 0
    for _, item in ipairs(items or {}) do
        local row = Instance.new("Frame")
        row.Size = UDim2.new(1, 0, 0, 64)
        row.BackgroundColor3 = Color3.fromRGB(25, 29, 43)
        row.Parent = itemsScroll
        Instance.new("UICorner", row).CornerRadius = UDim.new(0, 10)

        local name = Instance.new("TextLabel")
        name.BackgroundTransparency = 1
        name.Position = UDim2.new(0, 10, 0, 6)
        name.Size = UDim2.new(1, -170, 0, 20)
        name.Font = Enum.Font.GothamBold
        name.TextSize = 14
        name.TextXAlignment = Enum.TextXAlignment.Left
        name.TextColor3 = rarityColor(item.rarity)
        name.Text = string.format("%s [%s] x%d", item.name, item.rarity, item.count)
        name.Parent = row

        local detail = Instance.new("TextLabel")
        detail.BackgroundTransparency = 1
        detail.Position = UDim2.new(0, 10, 0, 30)
        detail.Size = UDim2.new(1, -170, 0, 24)
        detail.Font = Enum.Font.GothamMedium
        detail.TextSize = 12
        detail.TextXAlignment = Enum.TextXAlignment.Left
        detail.TextColor3 = Color3.fromRGB(165, 180, 219)
        detail.Text = string.format("+%d flat, +%.0f%% mult", item.flatIncome, item.multBonus * 100)
        detail.Parent = row

        local btn = Instance.new("TextButton")
        btn.AnchorPoint = Vector2.new(1, 0.5)
        btn.Position = UDim2.new(1, -10, 0.5, 0)
        btn.Size = UDim2.new(0, 120, 0, 32)
        btn.Font = Enum.Font.GothamBold
        btn.TextSize = 12
        btn.TextColor3 = Color3.new(1, 1, 1)
        btn.AutoButtonColor = true
        btn.Text = item.equipped and "UNEQUIP" or "EQUIP"
        btn.BackgroundColor3 = item.equipped and Color3.fromRGB(255, 107, 127) or Color3.fromRGB(89, 167, 255)
        btn.Parent = row
        Instance.new("UICorner", btn).CornerRadius = UDim.new(0, 8)

        btn.MouseButton1Click:Connect(function()
            actionRemote:FireServer("toggle_equip", { itemId = item.id })
        end)

        total += 71
    end
    itemsScroll.CanvasSize = UDim2.new(0, 0, 0, math.max(total, 1))
end

harvestBtn.MouseButton1Click:Connect(function()
    actionRemote:FireServer("harvest")
end)

crateBtn.MouseButton1Click:Connect(function()
    actionRemote:FireServer("open_crate")
end)

rebirthBtn.MouseButton1Click:Connect(function()
    actionRemote:FireServer("rebirth")
end)

speedBtn.MouseButton1Click:Connect(function()
    actionRemote:FireServer("upgrade_speed")
end)

jumpBtn.MouseButton1Click:Connect(function()
    actionRemote:FireServer("upgrade_jump")
end)

jetpackBtn.MouseButton1Click:Connect(function()
    if state.jetpackUnlocked then
        actionRemote:FireServer("jetpack")
    else
        actionRemote:FireServer("upgrade_jetpack")
    end
end)

local pathChoices = {
    { id = "industrialist", name = "Industrialist" },
    { id = "explorer", name = "Explorer" },
    { id = "aerialist", name = "Aerialist" },
}
local pathChoiceIndex = 1

pathBtn.MouseButton1Click:Connect(function()
    if state.pathChosen then
        showToast("Path is locked until next rebirth.", "info")
        return
    end
    if not state.pathSelectable then
        showToast("Rebirth once to unlock paths.", "error")
        return
    end
    local choice = pathChoices[pathChoiceIndex]
    actionRemote:FireServer("choose_path", { pathId = choice.id })
    pathChoiceIndex += 1
    if pathChoiceIndex > #pathChoices then
        pathChoiceIndex = 1
    end
end)

pathAbilityBtn.MouseButton1Click:Connect(function()
    actionRemote:FireServer("path_ability")
end)

RunService.RenderStepped:Connect(function(dt)
    local alpha = math.clamp(dt * 8, 0, 1)
    currentMoney += (targetMoney - currentMoney) * alpha
    currentIncome += (targetIncome - currentIncome) * alpha

    moneyLabel.Text = formatMoney(currentMoney)
    incomeLabel.Text = string.format("+%s/s", formatMoney(currentIncome):gsub("%$", ""))

    statText.Text = "Plot: " .. state.plot .. NL
        .. string.format("Stage: %d/%d (x%.2f income)", state.stage, state.stageMax, state.stageIncomeMult) .. NL
        .. "Rebirths: " .. tostring(state.rebirths) .. NL
        .. string.format("Stage Progress: %d/%d rebirths", state.stageProgress, state.stageProgressMax) .. NL
        .. string.format("Multiplier: x%.2f", state.multiplier) .. NL
        .. "Shards: " .. tostring(state.shards) .. NL
        .. "Path: " .. state.pathName .. NL
        .. string.format("Speed Lv.%d | Jump Lv.%d | Jetpack Lv.%d", state.speedLevel, state.jumpLevel, state.jetpackLevel) .. NL
        .. "Event: " .. state.eventName .. " (" .. tostring(math.max(0, state.eventTimeLeft)) .. "s)" .. NL
        .. "Potion: " .. state.buffName .. " (" .. tostring(math.max(0, state.buffTimeLeft)) .. "s)"
    rebirthCostText.Text = "Need: " .. formatMoney(state.rebirthCost)
    relicLabel.Text = "Relics: " .. tostring(state.relics)
end)

uiUpdateRemote.OnClientEvent:Connect(function(payload)
    targetMoney = payload.money or targetMoney
    targetIncome = payload.income or targetIncome

    state.plot = payload.plot or state.plot
    state.rebirths = payload.rebirths or state.rebirths
    state.multiplier = payload.multiplier or state.multiplier
    state.shards = payload.shards or state.shards
    state.rebirthCost = payload.rebirthCost or state.rebirthCost
    state.eventName = payload.eventName or state.eventName
    state.eventTimeLeft = payload.eventTimeLeft or 0
    state.buffName = payload.buffName or state.buffName
    state.buffTimeLeft = payload.buffTimeLeft or 0
    state.speedLevel = payload.speedLevel or state.speedLevel
    state.jumpLevel = payload.jumpLevel or state.jumpLevel
    state.jetpackLevel = payload.jetpackLevel or state.jetpackLevel
    state.speedCost = payload.speedCost or 0
    state.jumpCost = payload.jumpCost or 0
    state.jetpackCost = payload.jetpackCost or 0
    state.jetpackReadyIn = payload.jetpackReadyIn or 0
    state.jetpackUnlocked = payload.jetpackUnlocked == true
    state.relics = payload.relics or 0
    state.pathId = payload.pathId or ""
    state.pathName = payload.pathName or "Unchosen"
    state.pathAbilityName = payload.pathAbilityName or "No Ability"
    state.pathChosen = payload.pathChosen == true
    state.pathSelectable = payload.pathSelectable == true
    state.pathAbilityReadyIn = payload.pathAbilityReadyIn or 0
    state.overdriveTimeLeft = payload.overdriveTimeLeft or 0
    state.stage = payload.stage or state.stage
    state.stageMax = payload.stageMax or state.stageMax
    state.stageIncomeMult = payload.stageIncomeMult or state.stageIncomeMult
    state.lifetimeRebirths = payload.lifetimeRebirths or state.lifetimeRebirths
    state.stageProgress = payload.stageProgress or 0
    state.stageProgressMax = payload.stageProgressMax or state.stageProgressMax

    speedBtn.Text = state.speedCost > 0 and string.format("Speed + (%d shards)", state.speedCost) or "Speed MAX"
    jumpBtn.Text = state.jumpCost > 0 and string.format("Jump + (%d shards)", state.jumpCost) or "Jump MAX"

    if state.jetpackUnlocked then
        if state.jetpackReadyIn > 0 then
            jetpackBtn.Text = string.format("Jetpack Cooldown (%.1fs)", state.jetpackReadyIn)
            jetpackBtn.BackgroundColor3 = Color3.fromRGB(103, 105, 133)
        else
            jetpackBtn.Text = string.format("Jetpack Burst (Tier %d)", state.jetpackLevel)
            jetpackBtn.BackgroundColor3 = Color3.fromRGB(109, 111, 245)
        end
    else
        jetpackBtn.Text = state.jetpackCost > 0 and string.format("Unlock Jetpack (%d shards)", state.jetpackCost) or "Jetpack Locked"
        jetpackBtn.BackgroundColor3 = Color3.fromRGB(90, 98, 147)
    end

    if state.pathChosen then
        pathBtn.Text = "Path: " .. state.pathName
        pathBtn.BackgroundColor3 = Color3.fromRGB(86, 97, 132)
    else
        local choice = pathChoices[pathChoiceIndex]
        if state.pathSelectable and choice then
            pathBtn.Text = "Pick: " .. choice.name
            pathBtn.BackgroundColor3 = Color3.fromRGB(95, 117, 255)
        else
            pathBtn.Text = "Path Locked"
            pathBtn.BackgroundColor3 = Color3.fromRGB(75, 83, 122)
        end
    end

    if not state.pathChosen then
        pathAbilityBtn.Text = "Path Ability Locked"
        pathAbilityBtn.BackgroundColor3 = Color3.fromRGB(74, 104, 130)
    elseif state.pathAbilityReadyIn > 0 then
        pathAbilityBtn.Text = string.format("%s (%.1fs)", state.pathAbilityName, state.pathAbilityReadyIn)
        pathAbilityBtn.BackgroundColor3 = Color3.fromRGB(90, 106, 136)
    else
        pathAbilityBtn.Text = state.pathAbilityName
        pathAbilityBtn.BackgroundColor3 = Color3.fromRGB(82, 169, 247)
    end

    if state.overdriveTimeLeft > 0 then
        incomeLabel.TextColor3 = Color3.fromRGB(255, 226, 123)
    else
        incomeLabel.TextColor3 = Color3.fromRGB(111, 255, 163)
    end

    renderUpgrades(payload.upgrades)
    renderItems(payload.items)
end)

notifyRemote.OnClientEvent:Connect(function(payload)
    showToast(payload.text or "Update", payload.kind or "info")
end)

showToast("Tycoon simulator online. Paths, relics, and world events enabled.", "info")
