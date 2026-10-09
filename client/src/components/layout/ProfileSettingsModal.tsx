import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService, type UpdateMePayload } from '../../api/auth';
import { clearAccessToken } from '../../api/http';
import {
  Badge,
  Button,
  FormField,
  InlineAlert,
  Input,
  Modal,
  PasswordChecklist,
  PasswordInput,
  Spinner,
  Tabs,
  getTabId,
  getTabPanelId,
} from '../ui';
import { meetsPasswordRules } from '../../utils/passwordRules';
import { ROLE_BADGES } from '../../utils/userBadges';

export interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'profile' | 'security';

interface ProfileFormState {
  fullName: string;
  email: string;
}

const defaultProfile: ProfileFormState = {
  fullName: '',
  email: '',
};

export function ProfileSettingsModal({
  isOpen,
  onClose,
}: ProfileSettingsModalProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'USER' | 'ADMIN'>('USER');
  const [initialProfile, setInitialProfile] =
    useState<ProfileFormState>(defaultProfile);

  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [isChangingPw, setIsChangingPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const hasUnsavedChanges =
    fullName !== initialProfile.fullName ||
    email.trim() !== initialProfile.email;

  useEffect(() => {
    if (!isOpen || activeTab !== 'security') {
      setCurrentPw('');
      setNewPw('');
      setPwError('');
      setPwSuccess('');
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) {
      setProfileError('');
      setProfileSuccess('');
      return;
    }

    let cancelled = false;

    setIsLoadingProfile(true);
    setProfileError('');
    setProfileSuccess('');

    authService
      .getMe()
      .then((user) => {
        if (cancelled) return;
        const name = user.fullName ?? '';
        const userEmail = user.email ?? '';
        setFullName(name);
        setEmail(userEmail);
        setRole(user.role);
        setInitialProfile({
          fullName: name,
          email: userEmail,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setProfileError(
          err instanceof Error
            ? err.message
            : 'Failed to load your profile',
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleDiscard = () => {
    setFullName(initialProfile.fullName);
    setEmail(initialProfile.email);
    setProfileError('');
    setProfileSuccess('');
  };

  const handleSaveProfile = async () => {
    setProfileError('');
    setProfileSuccess('');

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setProfileError('Email address cannot be empty.');
      return;
    }

    const payload: UpdateMePayload = {};
    if (trimmedName !== initialProfile.fullName) {
      payload.fullName = trimmedName;
    }
    if (trimmedEmail !== initialProfile.email) {
      payload.email = trimmedEmail;
    }

    if (Object.keys(payload).length === 0) {
      setProfileError('No changes to save.');
      return;
    }

    setIsSavingProfile(true);

    try {
      const updated = await authService.updateMe(payload);
      const updatedName = updated.fullName ?? '';
      const updatedEmail = updated.email ?? '';

      setFullName(updatedName);
      setEmail(updatedEmail);
      setRole(updated.role);
      setInitialProfile({
        fullName: updatedName,
        email: updatedEmail,
      });

      if (payload.email !== undefined) {
        setProfileSuccess(
          'Profile saved. Check your new inbox ? you must verify the address before your next sign-in.',
        );
      } else {
        setProfileSuccess('Profile saved successfully.');
      }
    } catch (err: unknown) {
      setProfileError(
        err instanceof Error
          ? err.message
          : 'Failed to update user information',
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (!meetsPasswordRules(newPw)) {
      setPwError('Please meet all password requirements.');
      return;
    }

    setIsChangingPw(true);

    try {
      await authService.changePassword(currentPw, newPw);
      setPwSuccess('Password changed successfully.');
      setCurrentPw('');
      setNewPw('');
    } catch (err: unknown) {
      setPwError(
        err instanceof Error ? err.message : 'Failed to change password',
      );
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await authService.logout();
    } catch {
      /* ignore */
    }
    clearAccessToken();
    onClose();
    navigate('/login');
  };

  const profileFooter = (
    <>
      <Button
        variant="secondary"
        disabled={!hasUnsavedChanges || isSavingProfile}
        onClick={handleDiscard}
      >
        Discard
      </Button>
      <Button
        variant="primary"
        loading={isSavingProfile}
        disabled={isSavingProfile}
        onClick={handleSaveProfile}
      >
        Save changes
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="ml"
      title="Account settings"
      description="Manage your profile and password."
      bodyClassName="px-4 pb-4 pt-0"
      footer={activeTab === 'profile' ? profileFooter : undefined}
    >
      <Tabs
        label="Account settings"
        idPrefix="profile-settings"
        items={[
          { value: 'profile', label: 'Profile' },
          { value: 'security', label: 'Security' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'profile' ? (
        <div
          role="tabpanel"
          id={getTabPanelId('profile-settings', 'profile')}
          aria-labelledby={getTabId('profile-settings', 'profile')}
          className="space-y-4 pt-4"
        >
          {isLoadingProfile ? (
            <div className="flex h-32 items-center justify-center">
              <Spinner label="Loading profile" />
            </div>
          ) : (
            <>
              <FormField label="Full name" htmlFor="profile-fullname">
                <Input
                  id="profile-fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </FormField>

              <FormField
                label="Email"
                htmlFor="profile-email"
                hint="Changing your email requires verifying the new address before you can sign in again."
              >
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>

              <FormField label="Role">
                <div>
                  <Badge tone={ROLE_BADGES[role].tone}>
                    {ROLE_BADGES[role].label}
                  </Badge>
                </div>
              </FormField>

              {profileError && (
                <InlineAlert tone="error">{profileError}</InlineAlert>
              )}
              {profileSuccess && (
                <InlineAlert tone="success">{profileSuccess}</InlineAlert>
              )}
            </>
          )}
        </div>
      ) : (
        <div
          role="tabpanel"
          id={getTabPanelId('profile-settings', 'security')}
          aria-labelledby={getTabId('profile-settings', 'security')}
          className="space-y-5 pt-4"
        >
          <section>
            <h3 className="text-panel text-ink">Change password</h3>
            <form onSubmit={handleChangePassword} className="mt-3 space-y-3">
              <FormField
                label="Current password"
                htmlFor="profile-current-pw"
              >
                <PasswordInput
                  id="profile-current-pw"
                  autoComplete="current-password"
                  required
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                />
              </FormField>

              <FormField label="New password" htmlFor="profile-new-pw">
                <PasswordInput
                  id="profile-new-pw"
                  autoComplete="new-password"
                  required
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  aria-describedby="profile-password-rules"
                />
                <PasswordChecklist
                  id="profile-password-rules"
                  password={newPw}
                />
              </FormField>

              {pwError && <InlineAlert tone="error">{pwError}</InlineAlert>}
              {pwSuccess && (
                <InlineAlert tone="success">{pwSuccess}</InlineAlert>
              )}

              <Button
                type="submit"
                variant="primary"
                loading={isChangingPw}
                disabled={!meetsPasswordRules(newPw)}
              >
                Update password
              </Button>
            </form>
          </section>

          <section className="border-t border-line pt-4">
            <h3 className="text-panel text-ink">Session</h3>
            <Button
              variant="secondary"
              icon="logout"
              className="mt-3"
              onClick={handleSignOut}
            >
              Sign out of this session
            </Button>
            <p className="mt-3 text-small text-ink-muted">
              To delete your account, contact an administrator.
            </p>
          </section>
        </div>
      )}
    </Modal>
  );
}
