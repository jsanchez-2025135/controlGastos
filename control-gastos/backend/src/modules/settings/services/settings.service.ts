import { settingsRepository } from '../models/settings.repository';
import { NotificationSettings } from '../models/settings.model';

export class SettingsService {
  static async get(userId: string): Promise<Omit<NotificationSettings, 'userId' | 'updatedAt'>> {
    return settingsRepository.getEffective(userId);
  }

  static async update(userId: string, settings: Omit<NotificationSettings, 'userId' | 'updatedAt'>): Promise<NotificationSettings> {
    return settingsRepository.upsert(userId, settings);
  }
}