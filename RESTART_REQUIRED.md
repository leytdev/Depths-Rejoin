# Restart Required

You need to restart your bot for the following changes to take effect:

1. Fixed leaderboard button handlers - changed from `execute` to `run` method
2. Fixed leaderboard trash button - now properly deletes the message
3. Updated all leaderboard buttons to use the correct handler format

## How to Restart

Stop your bot process and start it again using your normal startup command.

## Changes Summary

The issue with the delete button in the leaderboards has been fixed. The button handlers were using `execute` method and `name` property instead of the expected `run` method and `customId` property that the InteractionHandlers class was looking for.

All leaderboard button handlers have been updated to use the correct format for consistency.
