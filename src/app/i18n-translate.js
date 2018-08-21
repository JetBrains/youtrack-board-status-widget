/*eslint no-magic-numbers: ["error", { "ignore": [1, 10, 100, 0, 2, 4, 11, 20] }]*/

import fecha from 'fecha';

class I18n {
  static GET_PLURALS_MAP = {
    ru: n => {
      if (n % 10 === 1 && n % 100 !== 11) {
        return 0;
      }
      return (n % 10 >= 2) && (n % 10 <= 4) && (n % 100 < 10 || n % 100 >= 20)
        ? 1
        : 2;
    },
    fr: n => (n > 1 ? 1 : 0),
    ja: () => 0,

    OTHERS: n => (n !== 1 ? 1 : 0)
  };

  static DEFAULT_CONTEXT = '$$noContext';

  constructor() {
    this.dictionary = {};
    this.getPlurals = I18n.GET_PLURALS_MAP.OTHERS;
  }

  setTranslations(lang, dictionary) {
    this.dictionary = dictionary || {};
    this.getPlurals = I18n.GET_PLURALS_MAP[lang] || I18n.GET_PLURALS_MAP.OTHERS;
  }

  interpolate(text, interpolationObject) {
    if (!interpolationObject || !Object.keys(interpolationObject).length) {
      return text;
    }
    const substringsForReplacing =
      getSubstringsForReplacing(text, interpolationObject);
    let resultText = text;
    Object.keys(substringsForReplacing).forEach(key => {
      if (substringsForReplacing[key] !== undefined) {
        resultText = resultText.replace(key, substringsForReplacing[key]);
      }
    });
    return resultText;

    function getSubstringsForReplacing(str, interpolationValues) {
      let currentInterpolatedFragmentStart = -1;
      const substringToValueMap = {};
      for (let i = 0; i < (str.length - 1); ++i) {
        if (str[i] === '{' && str[i + 1] === '{') {
          currentInterpolatedFragmentStart = i + 2;
          i = currentInterpolatedFragmentStart;
        } else if (str[i] === '}' && str[i + 1] === '}' &&
          currentInterpolatedFragmentStart > 0) {
          const variableName = str.substring(
            currentInterpolatedFragmentStart, i
          );
          substringToValueMap[`{{${variableName}}}`] =
            interpolationValues[variableName.trim()];
        }
      }
      return substringToValueMap;
    }
  }

  translate(text, interpolationObject, numberForPlurals, context) {
    const contexts = this.dictionary[text] || {};
    const currentTranslation = contexts[context || I18n.DEFAULT_CONTEXT] ||
      contexts;
    if (typeof currentTranslation === 'string') {
      return this.interpolate(currentTranslation, interpolationObject);
    }
    const pluralFormId = this.getPlurals(numberForPlurals || 1);
    return this.interpolate(
      currentTranslation[pluralFormId] || text, interpolationObject
    );
  }
}

const I18N_INSTANCE = new I18n();
export const i18n = I18N_INSTANCE.translate.bind(I18N_INSTANCE);

function configureFecha() {
  fecha.i18n.dayNamesShort = i18n('Sun|Mon|Tue|Wed|Thu|Fri|Sat').split('|');
  fecha.i18n.dayNames = i18n('Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday').split('|');
  fecha.i18n.monthNamesShort = i18n('Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec').split('|');
  fecha.i18n.monthNames = i18n('January|February|March|April|May|June|July|August|September|October|November|December').split('|');
  fecha.i18n.amPm = i18n('am|pm').split('|');
  fecha.masks.datePresentation = 'DD MMM YYYY';
  fecha.masks.dateAndTimePresentation = 'DD MMM YYYY HH:MM';
}

export function setLocale(lang, translations) {
  I18N_INSTANCE.setTranslations(lang, translations[lang]);
  configureFecha();
}
