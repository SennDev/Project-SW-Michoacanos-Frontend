import { InjectionToken } from '@angular/core';
import { ApiConfig } from '../../shared/models/api.models';

export const API_CONFIG = new InjectionToken<ApiConfig>('AGM API base URLs');
