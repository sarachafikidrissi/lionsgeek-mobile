const DEFAULT_SCHEMA = [
  { key: 'name', type: 'text', required: true, label: { en: 'Name', fr: 'Nom', ar: 'الاسم' } },
  { key: 'email', type: 'email', required: true, label: { en: 'Email', fr: 'Email', ar: 'البريد الإلكتروني' } },
  { key: 'phone', type: 'tel', required: false, label: { en: 'Phone', fr: 'Téléphone', ar: 'رقم الهاتف' } },
  {
    key: 'gender',
    type: 'select',
    required: true,
    label: { en: 'Gender', fr: 'Genre', ar: 'الجنس' },
    options: [
      { value: 'male', en: 'Male', fr: 'Homme', ar: 'ذكر' },
      { value: 'female', en: 'Female', fr: 'Femme', ar: 'أنثى' },
    ],
  },
];

const DEFAULT_KEYS = ['name', 'email', 'phone', 'gender'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeBookingKey(key) {
  if (!key || typeof key !== 'string') return '';
  let normalized = key.trim();
  normalized = normalized.replace(/\s+/gu, '_').replaceAll('.', '_');
  normalized = normalized.replace(/[^A-Za-z0-9_]/gu, '_').replace(/_+/gu, '_');
  normalized = normalized.replace(/^_+|_+$/g, '');
  return normalized.toLowerCase();
}

export function parseBookingForm(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mergeWithDefaults(form) {
  const arr = Array.isArray(form) ? form : [];
  const defaultByKey = Object.fromEntries(DEFAULT_SCHEMA.map((field) => [field.key, field]));
  const byKey = Object.fromEntries(arr.filter((field) => field?.key).map((field) => [field.key, field]));

  const mergedDefaults = DEFAULT_SCHEMA.map((field) => ({
    ...field,
    ...(byKey[field.key] || {}),
    key: field.key,
    type: field.type,
    required: field.required,
    options:
      field.type === 'select'
        ? Array.isArray(byKey[field.key]?.options)
          ? byKey[field.key].options
          : field.options
        : undefined,
    multiple:
      field.type === 'select'
        ? typeof byKey[field.key]?.multiple === 'boolean'
          ? byKey[field.key].multiple
          : field.multiple !== undefined
            ? field.multiple
            : true
        : undefined,
  }));

  const extras = arr.filter((field) => field?.key && !defaultByKey[field.key]);
  return [...mergedDefaults, ...extras];
}

export function getBookingFields(event) {
  const rawSchema = parseBookingForm(event?.booking_form);
  const schema = rawSchema.length ? mergeWithDefaults(rawSchema) : DEFAULT_SCHEMA;
  const defaultKeySet = new Set(DEFAULT_KEYS.map(normalizeBookingKey));
  const seen = new Set();
  const fields = [];

  const pushUnique = (field) => {
    const normalizedKey = normalizeBookingKey(field?.key);
    if (!normalizedKey || seen.has(normalizedKey)) return;
    seen.add(normalizedKey);
    fields.push(field);
  };

  DEFAULT_KEYS.forEach((key) => {
    const field = schema.find((item) => normalizeBookingKey(item?.key) === normalizeBookingKey(key));
    if (field) pushUnique(field);
  });

  schema.forEach((field) => {
    const normalizedKey = normalizeBookingKey(field?.key);
    if (!normalizedKey || defaultKeySet.has(normalizedKey)) return;
    pushUnique(field);
  });

  return fields;
}

function getUserProfileDefaults(user) {
  if (!user || typeof user !== 'object') {
    return { name: '', email: '', phone: '' };
  }

  const name = user.name ?? user.full_name ?? '';
  const email = user.email ?? '';
  const phone = user.phone ?? user.tel ?? user.mobile ?? '';

  return {
    name: name == null ? '' : String(name).trim(),
    email: email == null ? '' : String(email).trim(),
    phone: phone == null ? '' : String(phone).trim(),
  };
}

export function buildInitialAnswers(fields, user = null) {
  const profile = getUserProfileDefaults(user);
  const answers = {};

  fields.forEach((field) => {
    const key = field?.key;
    if (!key) return;

    const normalizedKey = normalizeBookingKey(key);
    if (field.type === 'select') {
      answers[key] = normalizedKey === 'gender' ? [] : field.multiple === false ? null : [];
      return;
    }

    if ((normalizedKey === 'name' || normalizedKey === 'full_name') && profile.name) {
      answers[key] = profile.name;
    } else if ((normalizedKey === 'email' || field.type === 'email') && profile.email) {
      answers[key] = profile.email;
    } else if ((normalizedKey === 'phone' || field.type === 'tel') && profile.phone) {
      answers[key] = profile.phone;
    } else {
      answers[key] = '';
    }
  });

  return answers;
}

export function getLocalizedText(value, language = 'en') {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value[language] || value.en || value.fr || value.ar || Object.values(value).find(Boolean) || '';
  }
  return String(value);
}

export function getFieldLabel(field, language = 'en') {
  if (!field) return '';
  if (typeof field.label === 'string') return field.label;
  if (field.label && typeof field.label === 'object') return getLocalizedText(field.label, language);
  return field.key || '';
}

export function getOptionLabel(option, language = 'en') {
  if (!option || typeof option !== 'object') return String(option ?? '');
  if (option.en || option.fr || option.ar) return getLocalizedText(option, language);
  if (option.label && typeof option.label === 'object') return getLocalizedText(option.label, language);
  if (typeof option.label === 'string') return option.label;
  return option.value ?? '';
}

function getSelectOptionValues(field) {
  const options = Array.isArray(field?.options) ? field.options : [];
  return options
    .map((option) => (typeof option === 'object' ? option?.value : null))
    .filter((value) => typeof value === 'string' && value !== '');
}

function isFieldMultiple(field) {
  const normalizedKey = normalizeBookingKey(field?.key);
  if (normalizedKey === 'gender') return true;
  return field?.multiple !== false;
}

export function validateBookingAnswers(fields, answers) {
  const errors = {};

  fields.forEach((field) => {
    const key = field?.key;
    if (!key) return;

    const normalizedKey = normalizeBookingKey(key);
    const label = getFieldLabel(field);
    const required = Boolean(field?.required);
    const rawValue = answers?.[key];

    if (field.type === 'select') {
      const optionValues = getSelectOptionValues(field);
      const multiple = isFieldMultiple(field);
      const isGender = normalizedKey === 'gender';

      if (multiple) {
        const values = Array.isArray(rawValue) ? rawValue : [];
        if (required && values.length === 0) {
          errors[key] = `${label} is required.`;
          return;
        }
        if (isGender && values.length > 1) {
          errors[key] = `${label} must have only one selection.`;
          return;
        }
        values.forEach((value) => {
          if (optionValues.length && !optionValues.includes(value)) {
            errors[key] = `${label} has an invalid option.`;
          }
        });
        return;
      }

      const value = typeof rawValue === 'string' ? rawValue : '';
      if (required && !value) {
        errors[key] = `${label} is required.`;
        return;
      }
      if (value && optionValues.length && !optionValues.includes(value)) {
        errors[key] = `${label} has an invalid option.`;
      }
      return;
    }

    const value = rawValue == null ? '' : String(rawValue).trim();

    if (required && !value) {
      errors[key] = `${label} is required.`;
      return;
    }

    if (!value) return;

    if (field.type === 'email') {
      if (!EMAIL_RE.test(value)) {
        errors[key] = `${label} must be a valid email address.`;
      } else if (value.length > 255) {
        errors[key] = `${label} must not exceed 255 characters.`;
      }
      return;
    }

    if (field.type === 'tel') {
      if (value.length > 20) {
        errors[key] = `${label} must not exceed 20 characters.`;
      }
      return;
    }

    if (value.length > 255) {
      errors[key] = `${label} must not exceed 255 characters.`;
    }
  });

  return errors;
}

export function extractBookingErrorMessage(error) {
  const data = error?.response?.data;
  if (data?.message) {
    if (typeof data.message === 'string') return data.message;
    if (typeof data.message === 'object') {
      return data.message.en || data.message.fr || data.message.ar || 'Booking failed.';
    }
  }

  const validationErrors = data?.errors;
  if (validationErrors && typeof validationErrors === 'object') {
    const first = Object.values(validationErrors).flat().find(Boolean);
    if (first) return String(first);
  }

  return error?.message || 'Could not complete booking. Please try again.';
}

export function hasUserBookedEvent(participants, email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !Array.isArray(participants)) return false;
  return participants.some((participant) => String(participant?.email || '').trim().toLowerCase() === normalized);
}
