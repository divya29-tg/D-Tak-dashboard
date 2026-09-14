import { useState, useRef, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/app/router/AppRouter';
import dtakLogo from '@/assets/dtak-logo.png';
import { gunService } from '@/services/gunService';
import { isAdminUser, setAdminUser, getAdminUsernames } from '@/utils/adminRegistry';
import './AdminLoginScreen.css';

/**
 * Gun/SEA requires an 8+ char secret; the 6-digit PIN is stretched into one
 * so the operator only ever types the PIN. This must match app.js's own
 * deep-link auto-login stretch exactly (`password += "Trus@" + password`,
 * i.e. the PIN duplicated around a fixed separator) -- a previous version
 * of this used a different, locally-invented suffix scheme, which meant an
 * admin account created here couldn't log in through the real dchat client
 * with the same PIN, and vice versa.
 */
function stretchPin(pin: string): string {
  return `${pin}Trus@${pin}`;
}

export function AdminLoginScreen() {
  const { login } = useAuth();

  const [adminId, setAdminId] = useState('');
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const pinArray = Array.from({ length: 6 }, (_, i) => pin[i] || '');

  const updatePinArray = (newArray: string[]) => {
    const newPin = newArray.join('');
    setPin(newPin);
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleAdminIdChange = (value: string) => {
    setAdminId(value);
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleInputChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '');

    if (!digits) {
      const newPinArray = [...pinArray];
      newPinArray[index] = '';
      updatePinArray(newPinArray);
      return;
    }

    if (digits.length > 1) {
      const pastedData = digits.slice(0, 6);
      const newPinArray = Array(6).fill('');
      for (let i = 0; i < pastedData.length; i++) {
        newPinArray[i] = pastedData[i];
      }
      updatePinArray(newPinArray);
      const nextFocusIndex = Math.min(pastedData.length, 5);
      inputRefs.current[nextFocusIndex]?.focus();
      return;
    }

    const newPinArray = [...pinArray];
    newPinArray[index] = digits;
    updatePinArray(newPinArray);

    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!pinArray[index] && index > 0) {
        e.preventDefault();
        const newPinArray = [...pinArray];
        newPinArray[index - 1] = '';
        updatePinArray(newPinArray);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const digits = pastedText.replace(/\D/g, '').slice(0, 6);
    if (digits) {
      const newPinArray = Array(6).fill('');
      for (let i = 0; i < digits.length; i++) {
        newPinArray[i] = digits[i];
      }
      updatePinArray(newPinArray);
      const nextFocusIndex = Math.min(digits.length, 5);
      inputRefs.current[nextFocusIndex]?.focus();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pin) {
      setErrorMessage('PIN is required');
      return;
    }

    if (pin.length < 6) {
      setErrorMessage('PIN must be exactly 6 digits');
      return;
    }

    const gunAlias = adminId.trim();
    const gunSecret = stretchPin(pin);

    // Bootstrap path: env credentials are only honored to create the very
    // first admin, before the Users list has anyone flagged as admin.
    const expectedAdminId = import.meta.env.VITE_LOCAL_ADMIN_ID;
    const expectedPin = import.meta.env.VITE_LOCAL_ADMIN_PIN;
    const isBootstrap =
      getAdminUsernames().length === 0 && gunAlias === expectedAdminId && pin === expectedPin;

    // Who gets into the console is controlled by the Users list (the "Grant
    // Admin Access" flag), not a fixed credential.
    if (!isAdminUser(gunAlias) && !isBootstrap) {
      setErrorMessage('This account is not authorized for admin access');
      return;
    }

    setErrorMessage(null);
    setIsAuthenticating(true);

    // Authenticate the admin against the Gun.js dchat network so the console
    // can send/read messages as this admin identity for the rest of the session.
    try {
      await gunService.loginUser(gunAlias, gunSecret);
    } catch (loginError) {
      if (isBootstrap) {
        // Never re-register over an alias that already has an account --
        // SEA's create() doesn't reliably error "already created" when the
        // relay hasn't finished syncing yet, so retrying it here is exactly
        // what mints a second, conflicting identity under the same alias
        // and leaves both unable to log in reliably afterward. If it
        // already exists, this was just a login hiccup (flaky relay) --
        // ask for a retry instead of touching registration again.
        const alreadyExists = await gunService.aliasExists(gunAlias);
        if (alreadyExists) {
          console.error('Gun.js admin authentication failed (account already exists):', loginError);
          setIsAuthenticating(false);
          setErrorMessage('Login failed — please try again in a moment.');
          return;
        }
        try {
          await gunService.registerUser(gunAlias, gunSecret);
          await gunService.loginUser(gunAlias, gunSecret);
        } catch (gunError) {
          console.error('Gun.js admin authentication failed:', gunError);
          setIsAuthenticating(false);
          setErrorMessage('Failed to reach the dchat network. Please try again.');
          return;
        }
      } else {
        console.error('Gun.js admin authentication failed:', loginError);
        setIsAuthenticating(false);
        setErrorMessage('Invalid Admin ID or PIN');
        return;
      }
    }

    if (isBootstrap) {
      setAdminUser(gunAlias, true);
    }

    setIsAuthenticating(false);
    // Updates the shared auth status the router's route guards actually
    // read; PublicOnlyRoute then redirects to HOME on its own re-render.
    login(gunAlias);
  };

  return (
    <main className="login-page">
      <div className="login-card">
        <button
          type="button"
          className="login-card__close-btn"
          aria-label="Close login console"
        >
          <X size={16} strokeWidth={2} />
        </button>

        <header className="login-header">
          <img src={dtakLogo} alt="DTAK Logo" className="login-header__logo-img" />
          <h1 className="login-header__brand">DTAK</h1>
          <p className="login-header__subtitle">Login to access control console</p>
        </header>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {errorMessage && (
            <div className="login-error-message" role="alert">
              {errorMessage}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="admin-id" className="form-label">
              ADMIN ID
            </label>
            <input
              id="admin-id"
              name="adminId"
              type="text"
              className="form-input"
              placeholder="e.g ADMIN-2201"
              autoComplete="username"
              value={adminId}
              onChange={(e) => handleAdminIdChange(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">PIN</label>
            <div className="pin-boxes-container">
              {pinArray.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  className={`pin-box ${digit ? 'pin-box--filled' : ''}`}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  onFocus={(e) => e.target.select()}
                  aria-label={`PIN digit ${index + 1} of 6`}
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                />
              ))}
            </div>
          </div>

          <button type="submit" className="login-submit-btn" disabled={isAuthenticating}>
            {isAuthenticating ? 'Connecting...' : 'Login'}
          </button>
        </form>
      </div>
    </main>
  );
}

