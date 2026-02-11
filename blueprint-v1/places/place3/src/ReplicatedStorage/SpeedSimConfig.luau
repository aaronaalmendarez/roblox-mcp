return {
    DataStoreName = "SpeedSim_Profile_v1",
    SaveIntervalSeconds = 30,

    BaseWalkSpeed = 16,
    WalkSpeedPerSpeed = 0.07,
    MaxWalkSpeed = 220,

    BaseJumpPower = 50,
    JumpPowerPerUpgrade = 14,
    MaxJumpUpgrade = 8,

    BaseSpeedGainPerStep = 0.22,
    RebirthSpeedMultiplier = 0.18,
    SprintUpgradeMultiplier = 0.2,
    MaxSprintUpgrade = 10,

    OrbCount = 50,
    OrbRespawnSeconds = 10,
    OrbReward = 6,

    RebirthBaseCost = 350,
    RebirthGrowth = 1.45,

    WinGateSpeed = 220,
    WinRewardGems = 120,
    WinRewardSpeed = 35,

    DailyClaimCooldownSeconds = 20 * 60 * 60,
    DailyClaimGems = 180,
    DailyClaimSpeed = 120,

    EventDurationSeconds = 120,
    EventCooldownSeconds = 85,
    Events = {
        {
            id = "double_speed",
            title = "Double Speed Rush",
            speedMultiplier = 2,
            gemsMultiplier = 1,
            gravityScale = 1,
        },
        {
            id = "gem_storm",
            title = "Gem Storm",
            speedMultiplier = 1,
            gemsMultiplier = 2,
            gravityScale = 1,
        },
        {
            id = "sky_stride",
            title = "Sky Stride",
            speedMultiplier = 1.35,
            gemsMultiplier = 1,
            gravityScale = 0.7,
        },
    },

    Shop = {
        jump = {
            id = "jump",
            title = "Jump Core",
            baseCost = 90,
            growth = 1.42,
        },
        sprint = {
            id = "sprint",
            title = "Sprint Engine",
            baseCost = 130,
            growth = 1.48,
        },
    },

    Quests = {
        { id = "gain_speed", title = "Gain 650 Speed", target = 650, rewardGems = 140, rewardSpeed = 45 },
        { id = "collect_orbs", title = "Collect 30 Orbs", target = 30, rewardGems = 170, rewardSpeed = 55 },
        { id = "use_pads", title = "Use Booster Pads 16 Times", target = 16, rewardGems = 220, rewardSpeed = 65 },
        { id = "claim_wins", title = "Claim 6 Wins", target = 6, rewardGems = 260, rewardSpeed = 80 },
    },

    World = {
        HubCenter = Vector3.new(0, 7, 0),
        GroundY = 0,
        GroundSize = Vector3.new(650, 2, 650),

        PortalPosition = Vector3.new(0, 10, -240),
        PortalSize = Vector3.new(24, 20, 5),

        BoosterPads = {
            { title = "Warm-Up", gain = 40, gems = 0, position = Vector3.new(-36, 2, 48), color = Color3.fromRGB(103, 214, 255) },
            { title = "Sprint Drill", gain = 80, gems = 10, position = Vector3.new(-12, 2, 48), color = Color3.fromRGB(123, 255, 165) },
            { title = "Rocket Launch", gain = 130, gems = 22, position = Vector3.new(12, 2, 48), color = Color3.fromRGB(255, 210, 88) },
            { title = "Hyper Charge", gain = 180, gems = 30, position = Vector3.new(36, 2, 48), color = Color3.fromRGB(255, 115, 115) },
        },

        OrbBounds = {
            minX = -210,
            maxX = 210,
            minZ = -210,
            maxZ = 210,
            y = 6,
        },

        Zones = {
            {
                id = "harbor",
                title = "Harbor Sprint",
                requiredSpeed = 0,
                gainMultiplier = 1,
                gemsMultiplier = 1,
                color = Color3.fromRGB(66, 186, 255),
                gatePosition = Vector3.new(-160, 8, -60),
                laneCenter = Vector3.new(-160, 1, -180),
                laneSize = Vector3.new(150, 2, 240),
            },
            {
                id = "reactor",
                title = "Reactor District",
                requiredSpeed = 450,
                gainMultiplier = 1.45,
                gemsMultiplier = 1.3,
                color = Color3.fromRGB(97, 255, 130),
                gatePosition = Vector3.new(0, 8, -60),
                laneCenter = Vector3.new(0, 1, -180),
                laneSize = Vector3.new(150, 2, 240),
            },
            {
                id = "void",
                title = "Void Highway",
                requiredSpeed = 1100,
                gainMultiplier = 2.1,
                gemsMultiplier = 1.7,
                color = Color3.fromRGB(255, 97, 214),
                gatePosition = Vector3.new(160, 8, -60),
                laneCenter = Vector3.new(160, 1, -180),
                laneSize = Vector3.new(150, 2, 240),
            },
        },
    },
}
