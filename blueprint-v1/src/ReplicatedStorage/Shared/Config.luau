local Config = {
    Economy = {
        StartingCash = 200,
        TickSeconds = 1,
        BaseIncomePerSecond = 2,
        RebirthRequirement = 15000,
        RebirthMultiplierStep = 0.3,
        AutoSaveSeconds = 45,
    },

    Tycoon = {
        PlotCount = 4,
        PlotRadius = 120,
        PlotBaseSize = Vector3.new(64, 1, 64),

        Upgrades = {
            {
                Id = "Dropper1",
                Name = "Starter Dropper",
                Cost = 150,
                IncomeBonus = 3,
                PadOffset = Vector3.new(-18, 2, -10),
            },
            {
                Id = "Dropper2",
                Name = "Dual Dropper",
                Cost = 450,
                IncomeBonus = 7,
                Requires = "Dropper1",
                PadOffset = Vector3.new(-8, 2, -10),
            },
            {
                Id = "Factory1",
                Name = "Mini Factory",
                Cost = 1200,
                IncomeBonus = 18,
                Requires = "Dropper2",
                PadOffset = Vector3.new(2, 2, -10),
            },
            {
                Id = "Factory2",
                Name = "Mega Factory",
                Cost = 4200,
                IncomeBonus = 52,
                Requires = "Factory1",
                PadOffset = Vector3.new(14, 2, -10),
            },
            {
                Id = "SpeedTraining",
                Name = "Speed +2",
                Cost = 700,
                Stat = "WalkSpeed",
                StatGain = 2,
                MaxLevel = 10,
                PadOffset = Vector3.new(-18, 2, 12),
            },
            {
                Id = "JumpTraining",
                Name = "Jump +2",
                Cost = 700,
                Stat = "JumpPower",
                StatGain = 2,
                MaxLevel = 10,
                PadOffset = Vector3.new(-8, 2, 12),
            },
            {
                Id = "AutoCollector",
                Name = "Auto Collector",
                Cost = 2600,
                Flag = "AutoCollect",
                Requires = "Factory1",
                PadOffset = Vector3.new(2, 2, 12),
            },
            {
                Id = "JetpackCore",
                Name = "Jetpack Core",
                Cost = 6400,
                Flag = "Jetpack",
                Requires = "Factory2",
                PadOffset = Vector3.new(14, 2, 12),
            },
        },

        Pickups = {
            SpawnSeconds = 8,
            LifetimeSeconds = 60,
            Radius = 165,
            Items = {
                {
                    Id = "CashCrate",
                    Name = "Cash Crate",
                    Chance = 0.5,
                    RewardCash = 500,
                    Color = Color3.fromRGB(56, 189, 248),
                },
                {
                    Id = "IncomePotion",
                    Name = "Income Potion",
                    Chance = 0.3,
                    IncomeMultiplier = 2,
                    Duration = 45,
                    Color = Color3.fromRGB(34, 197, 94),
                },
                {
                    Id = "JumpOrb",
                    Name = "Jump Orb",
                    Chance = 0.2,
                    JumpBonus = 30,
                    Duration = 30,
                    Color = Color3.fromRGB(251, 191, 36),
                },
            },
        },

        WorldEvents = {
            CooldownSeconds = 120,
            DurationSeconds = 45,
            List = {
                {
                    Id = "CashStorm",
                    Name = "Cash Storm",
                    IncomeMultiplier = 1.6,
                    Description = "Income boosted for everyone.",
                },
                {
                    Id = "LootRush",
                    Name = "Loot Rush",
                    PickupRateMultiplier = 2.4,
                    Description = "Pickups spawn much faster.",
                },
                {
                    Id = "MoonJump",
                    Name = "Moon Jump",
                    JumpBonus = 15,
                    Description = "Everyone gets extra jump power.",
                },
            },
        },

        Jetpack = {
            UpwardVelocity = 90,
            ForwardVelocity = 24,
            CooldownSeconds = 1.8,
        },
    },
}

return Config
