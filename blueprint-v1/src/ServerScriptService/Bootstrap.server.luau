local Players = game:GetService("Players")

Players.PlayerAdded:Connect(function(player)
    print(string.format("[BlueprintV1] %s joined", player.Name))
end)
