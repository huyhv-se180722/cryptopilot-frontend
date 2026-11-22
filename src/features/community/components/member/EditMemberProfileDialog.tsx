import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { Dialog } from '../../../../components/ui/Dialog';
import { Input } from '../../../../components/ui/Input';
import { Skeleton } from '../../../../components/ui/Skeleton';
import {
  fieldControlClass,
  fieldErrorClass,
  fieldLabelClass,
} from '../../../../components/ui/field-styles';
import { useCopy } from '../../../../hooks/use-copy';
import { useToast } from '../../../../hooks/use-toast';
import { formatCopy } from '../../../../i18n/copy';
import { errorText } from '../../../../i18n/messages';
import type { UserProfile } from '../../../../types/domain';
import { classNames } from '../../../../utils/class-names';
import {
  useOwnProfile,
  useSaveCommunityProfile,
  useUploadProfileImage,
} from '../../hooks/use-member-profile-edit';
import { AuthorAvatar } from '../PostParts';

const BIO_MAX = 300;
const LINK_MAX = 200;
const LINK = /^https:\/\/\S+$/;

/** An image of the page: the key to save and what to show for it. */
interface Picture {
  key: string | null;
  url: string | null;
}

/**
 * The Edit dialog of one's own member page (D-99): the banner and avatar,
 * uploaded straight to the media storage, the introduction and one link.
 * The display name stays on the Profile settings, where it is changed for
 * the whole application (UC-06).
 */
export function EditMemberProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const m = useCopy().community.member;
  const own = useOwnProfile(open);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={m.editTitle}
      description={m.editDescription}
      size="md"
    >
      {open &&
        (own.data ? (
          <EditForm
            key={own.dataUpdatedAt}
            profile={own.data}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
    </Dialog>
  );
}

function EditForm({
  profile,
  onDone,
}: {
  profile: UserProfile;
  onDone: () => void;
}) {
  const copy = useCopy();
  const m = copy.community.member;
  const { show } = useToast();
  const save = useSaveCommunityProfile();
  const [bio, setBio] = useState(profile.bio ?? '');
  const [link, setLink] = useState(profile.websiteUrl ?? '');
  const [avatar, setAvatar] = useState<Picture>({
    key: profile.avatarPublicId,
    url: profile.avatarUrl,
  });
  const [banner, setBanner] = useState<Picture>({
    key: profile.bannerPublicId,
    url: profile.bannerUrl,
  });
  const [uploading, setUploading] = useState(0);
  const trimmedLink = link.trim();
  const linkInvalid =
    trimmedLink !== '' &&
    (!LINK.test(trimmedLink) || trimmedLink.length > LINK_MAX);

  const submit = async () => {
    if (linkInvalid) return;
    const result = await save.run({
      bio: bio.trim() === '' ? null : bio.trim(),
      websiteUrl: trimmedLink === '' ? null : trimmedLink,
      avatarPublicId: avatar.key,
      bannerPublicId: banner.key,
    });
    if (result.status === 'success') {
      show({ tone: 'success', message: m.saved });
      onDone();
    } else if (result.status === 'error') {
      show({ tone: 'error', message: errorText(copy, result.error) });
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-4"
    >
      <ImageField
        label={m.banner}
        picture={banner}
        onChange={setBanner}
        onUploading={(busy) => setUploading((n) => n + (busy ? 1 : -1))}
        preview={(url) =>
          url ? (
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <div className="size-full bg-linear-135 from-primary-soft via-raised to-accent-soft" />
          )
        }
        wide
      />
      <ImageField
        label={m.avatar}
        picture={avatar}
        onChange={setAvatar}
        onUploading={(busy) => setUploading((n) => n + (busy ? 1 : -1))}
        preview={(url) => (
          <AuthorAvatar
            author={{ displayName: profile.displayName, avatarUrl: url }}
            size={56}
          />
        )}
      />
      <div>
        <label className={fieldLabelClass} htmlFor="member-bio">
          {m.bio}
        </label>
        <textarea
          id="member-bio"
          value={bio}
          maxLength={BIO_MAX}
          rows={3}
          onChange={(event) => setBio(event.target.value)}
          placeholder={m.bioPlaceholder}
          className={classNames(fieldControlClass, 'resize-none')}
        />
        <span className="mt-1 block text-right text-xs text-muted-dim">
          {formatCopy(m.bioCount, { n: bio.length, max: BIO_MAX })}
        </span>
      </div>
      <Input
        label={m.website}
        type="url"
        inputMode="url"
        value={link}
        maxLength={LINK_MAX}
        onChange={(event) => setLink(event.target.value)}
        placeholder={m.websitePlaceholder}
        error={linkInvalid ? m.websiteInvalid : undefined}
      />
      <p className="text-xs text-muted-dim">
        {m.nameElsewhere}{' '}
        <Link to="/profile" className="font-semibold text-primary">
          {m.profileSettings}
        </Link>
        .
      </p>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onDone}>
          {copy.common.cancel}
        </Button>
        <Button
          type="submit"
          disabled={
            linkInvalid || uploading > 0 || save.state.status === 'pending'
          }
        >
          {m.save}
        </Button>
      </div>
    </form>
  );
}

/**
 * One image of the page: its preview, Upload (or Change) and Remove. The
 * file goes to the storage at once; the page changes only on Save.
 */
function ImageField({
  label,
  picture,
  onChange,
  onUploading,
  preview,
  wide = false,
}: {
  label: string;
  picture: Picture;
  onChange: (picture: Picture) => void;
  onUploading: (busy: boolean) => void;
  preview: (url: string | null) => React.ReactNode;
  wide?: boolean;
}) {
  const copy = useCopy();
  const m = copy.community.member;
  const upload = useUploadProfileImage();
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  // A preview read from the chosen file is released when it is replaced.
  useEffect(
    () => () => {
      if (local) URL.revokeObjectURL(local);
    },
    [local],
  );

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setProgress(0);
    onUploading(true);
    const result = await upload.run(file, (share) =>
      setProgress(Math.round(share * 100)),
    );
    onUploading(false);
    setProgress(null);
    if (result.status === 'success') {
      const url = URL.createObjectURL(file);
      setLocal(url);
      onChange({ key: result.data, url });
    } else if (result.status === 'error') {
      setError(errorText(copy, result.error));
    }
  };

  return (
    <div>
      <span className={fieldLabelClass}>{label}</span>
      <div
        className={classNames('flex gap-3', wide ? 'flex-col' : 'items-center')}
      >
        <div
          className={classNames(
            'overflow-hidden',
            wide && 'h-24 w-full rounded-xl border border-line',
          )}
        >
          {preview(picture.url)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={label}
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={progress !== null}
            onClick={() => input.current?.click()}
          >
            <ImagePlus size={13} aria-hidden="true" />
            {progress !== null
              ? formatCopy(m.uploading, { percent: progress })
              : picture.key || picture.url
                ? m.change
                : m.upload}
          </Button>
          {(picture.key || picture.url) && progress === null && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ key: null, url: null })}
            >
              <Trash2 size={13} aria-hidden="true" />
              {m.remove}
            </Button>
          )}
          <span className="text-xs text-muted-dim">{m.imageFormats}</span>
        </div>
      </div>
      {error && (
        <span role="alert" className={fieldErrorClass}>
          {error}
        </span>
      )}
    </div>
  );
}
