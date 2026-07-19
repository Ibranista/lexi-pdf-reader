import * as Updates from "expo-updates";
import { Alert, AppState } from "react-native";

class UpdateManager {
  private static instance: UpdateManager;

  static getInstance(): UpdateManager {
    if (!UpdateManager.instance) {
      UpdateManager.instance = new UpdateManager();
    }
    return UpdateManager.instance;
  }

  async checkForUpdate(): Promise<boolean> {
    try {
      if (__DEV__) return false;

      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        console.log("New update available!");
        await Updates.fetchUpdateAsync();

        Alert.alert(
          "Update Available",
          "A new version is ready. Restart now?",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Restart",
              onPress: () => Updates.reloadAsync(),
            },
          ],
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error checking for update:", error);
      return false;
    }
  }

  setupAppStateListener() {
    AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        this.checkForUpdate();
      }
    });
  }
}

export default UpdateManager.getInstance();
