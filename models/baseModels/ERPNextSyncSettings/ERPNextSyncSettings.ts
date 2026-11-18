import { Doc } from 'fyo/model/doc';
import { ChangeArg, HiddenMap } from 'fyo/model/types';
import { initERPNSync, syncDocumentsToERPNext } from 'src/utils/erpnextSync';
import { ErrorLogEnum } from 'fyo/telemetry/types';

export class ERPNextSyncSettings extends Doc {
  deviceID?: string;
  instanceName?: string;
  baseURL?: string;
  authToken?: string;
  integrationAppVersion?: string;
  isEnabled?: boolean;
  initialSyncData?: boolean;

  dataSyncInterval?: string;
  syncDataFromServer?: boolean;
  syncDataToServer?: boolean;

  registerInstance?: string;
  syncSettings?: string;
  syncDataToERPNext?: string;
  fetchFromERPNextQueue?: string;
  clearSyncedDocsFromErpNextSyncQueue?: string;

  hidden: HiddenMap = {
    syncPriceList: () => {
      return !this.fyo.singles.AccountingSettings?.enablePriceList;
    },
    priceListSyncType: () => {
      return !this.fyo.singles.AccountingSettings?.enablePriceList;
    },
    syncSerialNumber: () => {
      return !this.fyo.singles.InventorySettings?.enableSerialNumber;
    },
    serialNumberSyncType: () => {
      return !this.fyo.singles.InventorySettings?.enableSerialNumber;
    },
    syncBatch: () => {
      return !this.fyo.singles.InventorySettings?.enableBatches;
    },
    batchSyncType: () => {
      return !this.fyo.singles.InventorySettings?.enableBatches;
    },
    syncDataFromServer: () => {
      return !this.deviceID;
    },
    syncDataToServer: () => {
      return !this.deviceID;
    },
  };

  async change(ch: ChangeArg) {
    const { showToast } = await import('src/utils/interactive');
    const operation =
      ch.changed === 'syncDataFromServer'
        ? 'sync_data_from_server'
        : 'sync_data_to_server';

    try {
      if (ch.changed === 'syncDataFromServer') {
        showToast({
          type: 'warning',
          message: 'Fetching data from server.',
          duration: 'very_long',
        });
        await initERPNSync(this.fyo);
        showToast({ type: 'success', message: 'Fetched data from server.' });
      } else if (ch.changed === 'syncDataToServer') {
        showToast({
          type: 'warning',
          message: 'Syncing data to server.',
          duration: 'very_long',
        });
        await syncDocumentsToERPNext(this.fyo);
        showToast({ type: 'success', message: 'Synced data to server.' });
      } else {
        return;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      showToast({ type: 'error', message: errorMessage });

      try {
        await this.fyo.doc
          .getNewDoc(ErrorLogEnum.IntegrationErrorLog, {
            error: errorMessage,
            data: JSON.stringify({
              instance: this.deviceID,
              operation,
              trigger: 'change_event',
            }),
          })
          .sync();
      } catch {
        // The toast already surfaced the sync failure.
      }
    }
  }
}
