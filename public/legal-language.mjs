import {addTranslations, installLanguage, setLanguage} from './i18n.mjs';
import {LEGAL_EN} from './legal-copy.mjs';

const requested = new URLSearchParams(location.search).get('lang');
if (requested === 'tr' || requested === 'en') setLanguage(requested);
addTranslations(LEGAL_EN);
installLanguage();
