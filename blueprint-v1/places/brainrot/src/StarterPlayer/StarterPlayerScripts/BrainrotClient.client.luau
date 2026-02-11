--[[
	BrainrotClient - Client-side brainrot controller
	Location: StarterPlayer.StarterPlayerScripts.BrainrotClient
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local SoundService = game:GetService("SoundService")

local LocalPlayer = Players.LocalPlayer
local Config = require(ReplicatedStorage:WaitForChild("BrainrotConfig"))

-- Wait for remotes
local remotesFolder = ReplicatedStorage:WaitForChild(Config.REMOTES.FOLDER)
local remotes = {
	updateStats = remotesFolder:WaitForChild(Config.REMOTES.UPDATE_STATS),
	ohioEvent = remotesFolder:WaitForChild(Config.REMOTES.OHIO_EVENT),
	playerDied = remotesFolder:WaitForChild(Config.REMOTES.PLAYER_DEATH),
	respawn = remotesFolder:WaitForChild(Config.REMOTES.RESPAWN),
}

-- Client state
local state = {
	rizz = Config.STARTING_RIZZ,
	sigma = Config.STARTING_SIGMA,
	money = 0,
	isGrimaced = false,
	currentEvent = nil,
}

-- Create UI
local playerGui = LocalPlayer:WaitForChild("PlayerGui")
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "BrainrotUI"
screenGui.ResetOnSpawn = false
screenGui.Parent = playerGui

-- Main HUD
local function createHUD()
	local container = Instance.new("Frame")
	container.Name = "HUD"
	container.Size = UDim2.new(0.25, 0, 0.2, 0)
	container.Position = UDim2.new(0, 10, 0, 10)
	container.BackgroundTransparency = 0.5
	container.BackgroundColor3 = Color3.new(0, 0, 0)
	container.Parent = screenGui

	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, 8)
	corner.Parent = container

	-- Title
	local title = Instance.new("TextLabel")
	title.Name = "Title"
	title.Size = UDim2.new(1, 0, 0.2, 0)
	title.BackgroundTransparency = 1
	title.TextColor3 = Config.COLORS.OHIO
	title.Text = "🔥 OHIO BRAINROT 🔥"
	title.Font = Enum.Font.GothamBold
	title.TextSize = 18
	title.Parent = container

	-- Rizz bar
	local rizzContainer = Instance.new("Frame")
	rizzContainer.Size = UDim2.new(0.9, 0, 0.15, 0)
	rizzContainer.Position = UDim2.new(0.05, 0, 0.3, 0)
	rizzContainer.BackgroundTransparency = 0.5
	rizzContainer.BackgroundColor3 = Color3.new(0.2, 0.2, 0.2)
	rizzContainer.Parent = container

	local rizzBar = Instance.new("Frame")
	rizzBar.Name = "Bar"
	rizzBar.Size = UDim2.new(1, 0, 1, 0)
	rizzBar.BackgroundColor3 = Config.COLORS.RIZZ
	rizzBar.Parent = rizzContainer

	local rizzLabel = Instance.new("TextLabel")
	rizzLabel.Size = UDim2.new(1, 0, 1, 0)
	rizzLabel.BackgroundTransparency = 1
	rizzLabel.TextColor3 = Color3.new(1, 1, 1)
	rizzLabel.Text = "RIZZ"
	rizzLabel.Font = Enum.Font.GothamBold
	rizzLabel.TextSize = 12
	rizzLabel.Parent = rizzContainer

	-- Sigma bar
	local sigmaContainer = Instance.new("Frame")
	sigmaContainer.Size = UDim2.new(0.9, 0, 0.15, 0)
	sigmaContainer.Position = UDim2.new(0.05, 0, 0.5, 0)
	sigmaContainer.BackgroundTransparency = 0.5
	sigmaContainer.BackgroundColor3 = Color3.new(0.2, 0.2, 0.2)
	sigmaContainer.Parent = container

	local sigmaBar = Instance.new("Frame")
	sigmaBar.Name = "Bar"
	sigmaBar.Size = UDim2.new(1, 0, 1, 0)
	sigmaBar.BackgroundColor3 = Config.COLORS.SIGMA
	sigmaBar.Parent = sigmaContainer

	local sigmaLabel = Instance.new("TextLabel")
	sigmaLabel.Size = UDim2.new(1, 0, 1, 0)
	sigmaLabel.BackgroundTransparency = 1
	sigmaLabel.TextColor3 = Color3.new(1, 1, 1)
	sigmaLabel.Text = "SIGMA"
	sigmaLabel.Font = Enum.Font.GothamBold
	sigmaLabel.TextSize = 12
	sigmaLabel.Parent = sigmaContainer

	-- Money
	local moneyLabel = Instance.new("TextLabel")
	moneyLabel.Name = "Money"
	moneyLabel.Size = UDim2.new(0.9, 0, 0.2, 0)
	moneyLabel.Position = UDim2.new(0.05, 0, 0.7, 0)
	moneyLabel.BackgroundTransparency = 1
	moneyLabel.TextColor3 = Config.COLORS.MONEY
	moneyLabel.Text = "$0"
	moneyLabel.Font = Enum.Font.GothamBold
	moneyLabel.TextSize = 24
	moneyLabel.Parent = container

	return { rizzBar = rizzBar, sigmaBar = sigmaBar, moneyLabel = moneyLabel }
end

local hud = createHUD()

-- Event overlay
local eventOverlay = Instance.new("Frame")
eventOverlay.Name = "EventOverlay"
eventOverlay.Size = UDim2.new(1, 0, 1, 0)
eventOverlay.BackgroundColor3 = Config.COLORS.OHIO
eventOverlay.BackgroundTransparency = 1
eventOverlay.ZIndex = 10
eventOverlay.Parent = screenGui

local eventText = Instance.new("TextLabel")
eventText.Size = UDim2.new(1, 0, 0.2, 0)
eventText.Position = UDim2.new(0, 0, 0.4, 0)
eventText.BackgroundTransparency = 1
eventText.TextColor3 = Color3.new(1, 1, 1)
eventText.Text = ""
eventText.Font = Enum.Font.GothamBlack
eventText.TextSize = 48
eventText.TextStrokeTransparency = 0.5
eventText.Parent = eventOverlay

-- Sounds
local sounds = {
	ohio = Instance.new("Sound"),
	levelUp = Instance.new("Sound"),
}

sounds.ohio.SoundId = Config.SOUNDS.OHIO
sounds.ohio.Volume = 0.5
sounds.ohio.Looped = true
sounds.ohio.Parent = SoundService

sounds.levelUp.SoundId = Config.SOUNDS.LEVEL_UP
sounds.levelUp.Volume = 0.8
sounds.levelUp.Parent = SoundService

sounds.ohio:Play()

-- Input
UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed then return end

	if input.KeyCode == Enum.KeyCode.LeftShift then
		local character = LocalPlayer.Character
		if character then
			local humanoid = character:FindFirstChild("Humanoid")
			if humanoid then
				humanoid.WalkSpeed = Config.SPRINT_SPEED
			end
		end
	end
end)

UserInputService.InputEnded:Connect(function(input)
	if input.KeyCode == Enum.KeyCode.LeftShift then
		local character = LocalPlayer.Character
		if character then
			local humanoid = character:FindFirstChild("Humanoid")
			if humanoid then
				humanoid.WalkSpeed = Config.WALK_SPEED
			end
		end
	end
end)

-- Collect Grimace Shakes
local function checkItemCollection()
	local character = LocalPlayer.Character
	if not character then return end

	local rootPart = character:FindFirstChild("HumanoidRootPart")
	if not rootPart then return end

	for _, item in pairs(workspace:GetChildren()) do
		if item.Name == "GrimaceShake" and item:IsA("BasePart") then
			if (item.Position - rootPart.Position).Magnitude < 5 then
				state.isGrimaced = true
				item:Destroy()
				-- Speed boost
				local humanoid = character:FindFirstChild("Humanoid")
				if humanoid then
					humanoid.WalkSpeed = Config.SPRINT_SPEED * Config.GRIMACE.SPEED_BOOST
					task.delay(Config.GRIMACE.EFFECT_DURATION, function()
						if humanoid and humanoid.Parent then
							humanoid.WalkSpeed = Config.WALK_SPEED
							state.isGrimaced = false
						end
					end)
				end
			end
		end
	end
end

-- Update HUD
local function updateHUD()
	hud.rizzBar.Size = UDim2.new(state.rizz / Config.MAX_RIZZ, 0, 1, 0)
	hud.sigmaBar.Size = UDim2.new(state.sigma / Config.MAX_SIGMA, 0, 1, 0)
	hud.moneyLabel.Text = "$" .. tostring(state.money)
end

-- Main loop
RunService.RenderStepped:Connect(function(_deltaTime)
	-- Sync with server
	local stats = remotes.updateStats:InvokeServer()
	if stats then
		state.rizz = stats.rizz
		state.sigma = stats.sigma
		state.money = stats.money
	end

	checkItemCollection()
	updateHUD()
end)

-- Event handlers
remotes.ohioEvent.OnClientEvent:Connect(function(eventType)
	state.currentEvent = eventType
	eventText.Text = "⚠️ " .. eventType .. " ⚠️"
	eventOverlay.BackgroundTransparency = 0.7

	TweenService:Create(eventOverlay, TweenInfo.new(0.5), { BackgroundTransparency = 1 }):Play()
	task.delay(2, function()
		eventText.Text = ""
	end)
end)

remotes.playerDied.OnClientEvent:Connect(function()
	-- Death screen
	local deathScreen = Instance.new("Frame")
	deathScreen.Size = UDim2.new(1, 0, 1, 0)
	deathScreen.BackgroundColor3 = Color3.new(0, 0, 0)
	deathScreen.BackgroundTransparency = 1
	deathScreen.ZIndex = 100
	deathScreen.Parent = screenGui

	TweenService:Create(deathScreen, TweenInfo.new(2), { BackgroundTransparency = 0 }):Play()
	task.wait(2)

	local deathText = Instance.new("TextLabel")
	deathText.Size = UDim2.new(1, 0, 0.2, 0)
	deathText.Position = UDim2.new(0, 0, 0.4, 0)
	deathText.BackgroundTransparency = 1
	deathText.TextColor3 = Color3.new(1, 0, 0)
	deathText.Text = "YOU DIED IN OHIO 💀"
	deathText.Font = Enum.Font.GothamBlack
	deathText.TextSize = 48
	deathText.TextTransparency = 1
	deathText.Parent = deathScreen

	TweenService:Create(deathText, TweenInfo.new(1), { TextTransparency = 0 }):Play()
	task.wait(3)

	local respawnText = Instance.new("TextLabel")
	respawnText.Size = UDim2.new(1, 0, 0.1, 0)
	respawnText.Position = UDim2.new(0, 0, 0.6, 0)
	respawnText.BackgroundTransparency = 1
	respawnText.TextColor3 = Color3.new(0.7, 0.7, 0.7)
	respawnText.Text = "Click to respawn fr fr"
	respawnText.Font = Enum.Font.Gotham
	respawnText.TextSize = 20
	respawnText.Parent = deathScreen

	deathScreen.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			remotes.respawn:FireServer()
			deathScreen:Destroy()
		end
	end)
end)

print("[BrainrotClient] 🔥 Ready to grind in Ohio 🔥")
