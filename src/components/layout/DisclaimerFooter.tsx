import { useCopy } from '../../hooks/use-copy';

/**
 * MSG42 disclaimer shown in the footer of every shell (BR-60), with the
 * chart library's attribution: its licence (Apache 2.0 with TradingView's
 * NOTICE) asks for the notice and a link to tradingview.com on a page the
 * users see. The footer carries both, so the charts need no logo.
 */
export function DisclaimerFooter() {
  const copy = useCopy();
  return (
    <footer className="border-t border-line px-4 py-4 text-center text-[11px] leading-relaxed text-muted-x">
      <p>{copy.messages.MSG42}</p>
      <p className="mt-1">
        <a
          href="https://www.tradingview.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-x underline-offset-2 hover:underline"
        >
          {copy.chart.credit}
        </a>{' '}
        {copy.chart.creditCopyright}
      </p>
    </footer>
  );
}
