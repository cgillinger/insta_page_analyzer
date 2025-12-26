import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Kombinerar CSS-klasser och hanterar Tailwind-konflikter
 * @param  {...any} inputs - CSS-klasser att kombinera
 * @returns {string} - Kombinerade CSS-klasser
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Formaterar ett datum enligt svensk standard
 * @param {Date|string} date - Datum att formatera
 * @returns {string} - Formaterat datum
 */
export function formatDate(date) {
  const d = new Date(date)
  return d.toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Formaterar ett nummer med tusentalsavgränsare
 * @param {number} number - Nummer att formatera
 * @returns {string} - Formaterat nummer
 */
export function formatNumber(number) {
  return new Intl.NumberFormat('sv-SE').format(number)
}

/**
 * Validerar en CSV-fil
 * @param {File} file - Filen att validera
 * @returns {boolean} - true om filen är giltig
 */
export function isValidCSVFile(file) {
  return file && (
    file.type === 'text/csv' ||
    file.name.toLowerCase().endsWith('.csv')
  )
}

/**
 * Genererar en unik ID-sträng
 * @returns {string} - Unik ID
 */
export function generateId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

/**
 * Formaterar månadsnamn för visning
 * @param {number} monthNumber - Månadsnummer (1-12)
 * @returns {string} - Formaterat månadsnamn på svenska
 */
export function formatMonthName(monthNumber) {
  const months = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ]
  return months[monthNumber - 1] || 'Okänd månad'
}

/**
 * Formaterar period för visning (år och månad)
 * @param {number} year - År
 * @param {number} month - Månad (1-12)
 * @returns {string} - Formaterad period
 */
export function formatPeriod(year, month) {
  return `${formatMonthName(month)} ${year}`
}
