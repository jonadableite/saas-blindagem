// src/actions/instance/index.tsx
import { getInstanceStatus } from "./connection-status";
import { createInstance } from "./create-instance";
import { deleteInstance } from "./delete-instance";
import { fetchInstanceDetails } from "./fetch-instance-details";
import { fetchInstanceSettings } from "./fetch-instance-settings";
import { fetchInstances } from "./fetch-instances";
import { getInstanceQrCode } from "./instance-connect";
import { logoutInstance } from "./logout-instance";
import { restartInstance } from "./restart-instance";
import { setInstancePresence } from "./set-presence";
import { updateInstanceSettings } from "./update-instance-settings";

export {
  createInstance,
  deleteInstance,
  fetchInstanceDetails,
  fetchInstances,
  fetchInstanceSettings,
  getInstanceQrCode,
  getInstanceStatus,
  logoutInstance,
  restartInstance,
  setInstancePresence,
  updateInstanceSettings
};

