import type { HTMLAttributes } from 'react';
import { classNames } from '../../utils/class-names';
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames('card', className)} {...props} />;
}
