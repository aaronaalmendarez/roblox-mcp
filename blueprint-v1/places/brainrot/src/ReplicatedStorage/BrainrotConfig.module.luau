--[[
	BrainrotConfig - Ultimate Brainrot Game Configuration
	Location: ReplicatedStorage.BrainrotConfig
]]

local BrainrotConfig = {}

-- Game Info
BrainrotConfig.GAME_NAME = "OHIO BRAINROT CHAOS"
BrainrotConfig.VERSION = "1.0.0 SIGMA EDITION"

-- Player Stats
BrainrotConfig.MAX_RIZZ = 100
BrainrotConfig.MAX_SIGMA = 100
BrainrotConfig.MAX_MONEY = 999999999
BrainrotConfig.STARTING_RIZZ = 10
BrainrotConfig.STARTING_SIGMA = 5

-- Movement (Ohio physics)
BrainrotConfig.WALK_SPEED = 20
BrainrotConfig.SPRINT_SPEED = 40
BrainrotConfig.JUMP_POWER = 60
BrainrotConfig.GRAVITY = 150

-- Skibidi Toilet Settings
BrainrotConfig.SKIBIDI = {
	SPAWN_RATE = 5,
	MAX_COUNT = 20,
	SPEED_NORMAL = 10,
	SPEED_ANGRY = 25,
	HEALTH = 100,
	DAMAGE = 15,
	DETECTION_RANGE = 50,
}

-- Sigma Enemies
BrainrotConfig.SIGMA_ENEMY = {
	SPAWN_RATE = 8,
	MAX_COUNT = 10,
	SPEED = 15,
	HEALTH = 200,
	GRIND_RANGE = 30,
}

-- Grimace Shake
BrainrotConfig.GRIMACE = {
	SPAWN_INTERVAL = 30,
	EFFECT_DURATION = 10,
	SPEED_BOOST = 1.5,
}

-- Rizz System
BrainrotConfig.RIZZ = {
	REGEN_RATE = 1,
	LEVEL_THRESHOLDS = {0, 25, 50, 75, 100},
	LEVEL_NAMES = {"NPC", "Beta", "Normie", "Rizzler", "SIGMA MALE"},
}

-- Ohio Events
BrainrotConfig.OHIO_EVENTS = {
	INTERVAL = {min = 30, max = 90},
	TYPES = {"GRAVITY_FLIP", "SPEED_CHAOS", "SKIBIDI_INVASION", "SIGMA_HOUR", "GRIMACE_PARTY"},
}

-- Sounds
BrainrotConfig.SOUNDS = {
	SKIBIDI = "rbxassetid://9124247535",
	OHIO = "rbxassetid://1839339680",
	SIGMA = "rbxassetid://1848021323",
	RIZZ = "rbxassetid://12221984",
	GRIMACE = "rbxassetid://14031128603",
	VINE_BOOM = "rbxassetid://16071491431",
	OOF = "rbxassetid://5765635210",
	LEVEL_UP = "rbxassetid://6895079803",
}

-- Colors
BrainrotConfig.COLORS = {
	SKIBIDI = Color3.fromRGB(139, 69, 19),
	SIGMA = Color3.fromRGB(50, 50, 50),
	GRIMACE = Color3.fromRGB(128, 0, 128),
	OHIO = Color3.fromRGB(255, 165, 0),
	RIZZ = Color3.fromRGB(255, 105, 180),
	MONEY = Color3.fromRGB(0, 255, 0),
}

-- Remotes
BrainrotConfig.REMOTES = {
	FOLDER = "BrainrotRemotes",
	UPDATE_STATS = "UpdateStats",
	SPAWN_ENEMY = "SpawnEnemy",
	KILL_ENEMY = "KillEnemy",
	OHIO_EVENT = "OhioEvent",
	PLAYER_DIED = "PlayerDied",
	RESPAWN = "Respawn",
}

return BrainrotConfig
