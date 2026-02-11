--[[
	BrainrotServer - Ultimate Brainrot Game Server
	Location: ServerScriptService.BrainrotServer
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local Config = require(ReplicatedStorage:WaitForChild("BrainrotConfig"))

-- Create remotes
local remoteFolder = Instance.new("Folder")
remoteFolder.Name = Config.REMOTES.FOLDER
remoteFolder.Parent = ReplicatedStorage

local function createRemote(name, remoteType)
	local remote = Instance.new(remoteType or "RemoteEvent")
	remote.Name = name
	remote.Parent = remoteFolder
	return remote
end

local remotes = {
	updateStats = createRemote(Config.REMOTES.UPDATE_STATS, "RemoteFunction"),
	spawnEnemy = createRemote(Config.REMOTES.SPAWN_ENEMY),
	killEnemy = createRemote(Config.REMOTES.KILL_ENEMY),
	ohioEvent = createRemote(Config.REMOTES.OHIO_EVENT),
	playerDied = createRemote(Config.REMOTES.PLAYER_DEATH),
	respawn = createRemote(Config.REMOTES.RESPAWN),
}

-- Player data
local playerData = {}

-- Enemies
local enemies = { skibidi = {}, sigma = {} }

-- Game state
local gameState = {
	currentEvent = nil,
	eventEndTime = 0,
	grimaceShakes = {},
}

-- Initialize player
local function initPlayer(player)
	playerData[player.UserId] = {
		rizz = Config.STARTING_RIZZ,
		sigma = Config.STARTING_SIGMA,
		money = 0,
		kills = 0,
		rizzLevel = 1,
		isGrimaced = false,
	}
end

-- Create Skibidi Toilet
local function createSkibidi(position)
	local model = Instance.new("Model")
	model.Name = "SkibidiToilet"

	local toilet = Instance.new("Part")
	toilet.Name = "Toilet"
	toilet.Size = Vector3.new(3, 4, 3)
	toilet.Position = position
	toilet.Anchored = false
	toilet.Color = Config.COLORS.SKIBIDI
	toilet.Material = Enum.Material.SmoothPlastic
	toilet.Parent = model
	model.PrimaryPart = toilet

	local head = Instance.new("Part")
	head.Name = "Head"
	head.Shape = Enum.PartType.Ball
	head.Size = Vector3.new(2.5, 2.5, 2.5)
	head.Position = position + Vector3.new(0, 3, 0)
	head.Anchored = false
	head.Color = Color3.fromRGB(255, 200, 150)
	head.Parent = model

	local humanoid = Instance.new("Humanoid")
	humanoid.MaxHealth = Config.SKIBIDI.HEALTH
	humanoid.Health = Config.SKIBIDI.HEALTH
	humanoid.WalkSpeed = Config.SKIBIDI.SPEED_NORMAL
	humanoid.Parent = model

	model.Parent = Workspace
	model:SetAttribute("EnemyType", "Skibidi")

	table.insert(enemies.skibidi, model)
	return model
end

-- Create Sigma enemy
local function createSigma(position)
	local model = Instance.new("Model")
	model.Name = "SigmaMale"

	local torso = Instance.new("Part")
	torso.Name = "Torso"
	torso.Size = Vector3.new(2, 3, 1)
	torso.Position = position
	torso.Anchored = false
	torso.Color = Config.COLORS.SIGMA
	torso.Material = Enum.Material.Metal
	torso.Parent = model
	model.PrimaryPart = torso

	local head = Instance.new("Part")
	head.Name = "Head"
	head.Size = Vector3.new(1.5, 1.5, 1.5)
	head.Position = position + Vector3.new(0, 2.5, 0)
	head.Anchored = false
	head.Color = Config.COLORS.SIGMA
	head.Parent = model

	local eyeLight = Instance.new("PointLight")
	eyeLight.Color = Color3.fromRGB(0, 255, 255)
	eyeLight.Brightness = 3
	eyeLight.Range = 15
	eyeLight.Parent = head

	local humanoid = Instance.new("Humanoid")
	humanoid.MaxHealth = Config.SIGMA_ENEMY.HEALTH
	humanoid.Health = Config.SIGMA_ENEMY.HEALTH
	humanoid.WalkSpeed = Config.SIGMA_ENEMY.SPEED
	humanoid.Parent = model

	model.Parent = Workspace
	model:SetAttribute("EnemyType", "Sigma")

	table.insert(enemies.sigma, model)
	return model
end

-- Spawn Grimace Shake
local function spawnGrimaceShake()
	local shake = Instance.new("Part")
	shake.Name = "GrimaceShake"
	shake.Size = Vector3.new(1, 2, 1)
	shake.Position = Vector3.new(math.random(-100, 100), 5, math.random(-100, 100))
	shake.Anchored = true
	shake.Color = Config.COLORS.GRIMACE
	shake.Material = Enum.Material.Neon
	shake.Shape = Enum.PartType.Cylinder
	shake.Orientation = Vector3.new(0, 0, 90)
	shake.Parent = Workspace

	local light = Instance.new("PointLight")
	light.Color = Config.COLORS.GRIMACE
	light.Brightness = 2
	light.Range = 10
	light.Parent = shake

	table.insert(gameState.grimaceShakes, shake)
end

-- Update enemy AI
local function updateEnemies(deltaTime)
	for _, skibidi in pairs(enemies.skibidi) do
		if not skibidi or not skibidi.Parent then continue end

		local humanoid = skibidi:FindFirstChild("Humanoid")
		local torso = skibidi.PrimaryPart
		if not humanoid or not torso then continue end

		local nearestPlayer = nil
		local nearestDist = math.huge

		for _, player in pairs(Players:GetPlayers()) do
			if player.Character and player.Character:FindFirstChild("HumanoidRootPart") then
				local dist = (player.Character.HumanoidRootPart.Position - torso.Position).Magnitude
				if dist < nearestDist then
					nearestPlayer = player
					nearestDist = dist
				end
			end
		end

		if nearestPlayer and nearestDist < Config.SKIBIDI.DETECTION_RANGE then
			local isAngry = nearestDist < 20
			humanoid.WalkSpeed = isAngry and Config.SKIBIDI.SPEED_ANGRY or Config.SKIBIDI.SPEED_NORMAL
			humanoid:MoveTo(nearestPlayer.Character.HumanoidRootPart.Position)

			if nearestDist < 5 then
				local targetHumanoid = nearestPlayer.Character:FindFirstChild("Humanoid")
				local data = playerData[nearestPlayer.UserId]
				if targetHumanoid and data and not data.isGrimaced then
					targetHumanoid:TakeDamage(Config.SKIBIDI.DAMAGE * deltaTime)
				end
			end
		end
	end
end

-- Trigger Ohio Event
local function triggerOhioEvent()
	local eventType = Config.OHIO_EVENTS.TYPES[math.random(1, #Config.OHIO_EVENTS.TYPES)]
	gameState.currentEvent = eventType
	gameState.eventEndTime = os.clock() + 15

	remotes.ohioEvent:FireAllClients(eventType)

	if eventType == "GRAVITY_FLIP" then
		Workspace.Gravity = -Config.GRAVITY
		task.delay(15, function()
			Workspace.Gravity = Config.GRAVITY
		end)
	elseif eventType == "SKIBIDI_INVASION" then
		for _ = 1, 5 do
			createSkibidi(Vector3.new(math.random(-50, 50), 5, math.random(-50, 50)))
		end
	elseif eventType == "SIGMA_HOUR" then
		for _ = 1, 3 do
			createSigma(Vector3.new(math.random(-50, 50), 5, math.random(-50, 50)))
		end
	elseif eventType == "GRIMACE_PARTY" then
		for _ = 1, 3 do
			spawnGrimaceShake()
		end
	end

	print("[BrainrotServer] OHIO EVENT:", eventType)
end

-- Player handlers
local function onPlayerAdded(player)
	initPlayer(player)

	player.CharacterAdded:Connect(function(character)
		local humanoid = character:WaitForChild("Humanoid")
		humanoid.WalkSpeed = Config.WALK_SPEED
		humanoid.JumpPower = Config.JUMP_POWER

		local data = playerData[player.UserId]
		if data then data.isGrimaced = false end

		humanoid.Died:Connect(function()
			remotes.playerDied:FireClient(player)
			if data then data.money = math.floor(data.money / 2) end
		end)
	end)
end

local function onPlayerRemoving(player)
	playerData[player.UserId] = nil
end

-- Main loop
RunService.Heartbeat:Connect(function(deltaTime)
	updateEnemies(deltaTime)

	-- Spawn enemies
	if #enemies.skibidi < Config.SKIBIDI.MAX_COUNT and math.random() < 0.02 then
		createSkibidi(Vector3.new(math.random(-100, 100), 5, math.random(-100, 100)))
	end

	if #enemies.sigma < Config.SIGMA_ENEMY.MAX_COUNT and math.random() < 0.01 then
		createSigma(Vector3.new(math.random(-100, 100), 5, math.random(-100, 100)))
	end

	-- Grimace spawns
	if #gameState.grimaceShakes < 3 and math.random() < 0.005 then
		spawnGrimaceShake()
	end

	-- Ohio events
	if os.clock() > gameState.eventEndTime and math.random() < 0.001 then
		triggerOhioEvent()
	end

	-- Rizz regen
	for _, player in pairs(Players:GetPlayers()) do
		local data = playerData[player.UserId]
		if data then
			data.rizz = math.min(data.rizz + Config.RIZZ.REGEN_RATE * deltaTime, Config.MAX_RIZZ)
			data.sigma = math.min(data.sigma + 0.1 * deltaTime, Config.MAX_SIGMA)
		end
	end
end)

-- Remote handlers
remotes.updateStats.OnServerInvoke = function(player)
	return playerData[player.UserId]
end

remotes.respawn.OnServerEvent:Connect(function(player)
	local data = playerData[player.UserId]
	if data then
		data.rizz = Config.STARTING_RIZZ
		data.isGrimaced = false
	end
end)

-- Connect events
Players.PlayerAdded:Connect(onPlayerAdded)
Players.PlayerRemoving:Connect(onPlayerRemoving)

for _, player in pairs(Players:GetPlayers()) do
	onPlayerAdded(player)
end

-- Ohio gravity
Workspace.Gravity = Config.GRAVITY

-- Initial spawns
for _ = 1, 3 do
	createSkibidi(Vector3.new(math.random(-50, 50), 5, math.random(-50, 50)))
end

print("[BrainrotServer] 🔥 OHIO BRAINROT CHAOS INITIALIZED 🔥")
