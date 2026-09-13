import type { ButtonHTMLAttributes } from 'react';
import { classNames } from '../../utils/class-names';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
};
export function Button({
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={classNames('button', 'button-' + variant, className)}
      {...props}
    />
  );
}
