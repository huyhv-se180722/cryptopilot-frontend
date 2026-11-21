import type { JournalReview, ManualTradeInput } from '../../types/domain';
import { checkFile, send } from './community';
import type { UploadForm } from './community-dto';
import type { JournalService } from './contracts';
import { integrationPending } from './errors';
import type { HttpClient } from './http-client';
import {
  decodeChartImageForm,
  decodeJournalEntry,
  decodeJournalPage,
  decodeStrategies,
} from './journal-dto';

const withSignal = (signal?: AbortSignal) => (signal ? { signal } : {});

/** Used while no API base URL is configured. */
export function createJournalService(): JournalService {
  const pending = async () => integrationPending();
  return {
    list: pending,
    get: pending,
    record: pending,
    edit: pending,
    remove: pending,
    review: pending,
    uploadChartImage: pending,
    strategies: pending,
  };
}

/** The body of `POST /journal` and `PUT /journal/{id}` (UC-24). */
function manualBody(input: ManualTradeInput) {
  return {
    pairId: input.pairId,
    market: input.market.toUpperCase(),
    direction: input.direction,
    leverage: input.leverage,
    entryPrice: input.entryPrice,
    quantity: input.quantity,
    entryTime: input.entryTime,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    exitPrice: input.exitPrice,
    exitTime: input.exitTime,
    feeAmount: input.feeAmount,
    fundingFeeAmount: input.fundingFeeAmount,
    strategyId: input.strategyId,
    setupDescription: input.setupDescription,
    lessonsLearned: input.lessonsLearned,
    mistakes: input.mistakes,
  };
}

/**
 * The body of `PUT /journal/{id}/review`: every review field, as the
 * backend clears the ones left out and refuses any other (BR-40).
 */
function reviewBody(review: JournalReview) {
  return {
    strategyId: review.strategyId,
    setupDescription: review.setupDescription,
    lessonsLearned: review.lessonsLearned,
    mistakes: review.mistakes,
    chartImagePublicId: review.chartImageKey,
  };
}

/** `/journal/**` and `/strategies` with the bearer token (Trader only). */
export function createHttpJournalService(http: HttpClient): JournalService {
  const entry = (id: string) => 'journal/' + encodeURIComponent(id);
  return {
    list: ({ status, pairId, market, page, pageSize }, signal) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (status) params.set('status', status);
      if (pairId) params.set('pairId', pairId);
      if (market) params.set('market', market.toUpperCase());
      return http.request({
        path: 'journal?' + params.toString(),
        decode: decodeJournalPage,
        ...withSignal(signal),
      });
    },
    get: (id, signal) =>
      http.request({
        path: entry(id),
        decode: decodeJournalEntry,
        ...withSignal(signal),
      }),
    record: (input) =>
      http.request({
        path: 'journal',
        method: 'POST',
        body: manualBody(input),
        decode: decodeJournalEntry,
      }),
    edit: (id, input) =>
      http.request({
        path: entry(id),
        method: 'PUT',
        body: manualBody(input),
        decode: decodeJournalEntry,
      }),
    remove: (id) =>
      http.request({
        path: entry(id),
        method: 'DELETE',
        decode: () => undefined,
      }),
    review: (id, review) =>
      http.request({
        path: entry(id) + '/review',
        method: 'PUT',
        body: reviewBody(review),
        decode: decodeJournalEntry,
      }),
    uploadChartImage: async (id, file, onProgress, signal) => {
      const signed = await http.request({
        path: entry(id) + '/chart-image/upload-signature',
        method: 'POST',
        decode: decodeChartImageForm,
        ...withSignal(signal),
      });
      // The storage form of the community's uploads; the backend signs
      // `overwrite=false` with the journal's key as well.
      const form: UploadForm = {
        ...signed,
        overwrite: false,
        kind: 'IMAGE',
        maxDurationSeconds: null,
      };
      checkFile(file, form, null);
      await send(file, form, onProgress, signal);
      return signed.publicId;
    },
    strategies: (signal) =>
      http.request({
        path: 'strategies',
        decode: decodeStrategies,
        ...withSignal(signal),
      }),
  };
}
