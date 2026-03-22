/**
 * POST /api/fix-sectors
 * One-time fix: fetches today's data from ShareSansar which includes sector info,
 * and updates the sector_id for each company in the DB.
 * Call once from browser: fetch('/api/fix-sectors', {method:'POST'})
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import nepsePool from '@/lib/db-nepse'
import { RowDataPacket } from 'mysql2'

export const runtime = 'nodejs'

// NEPSE sector classification by symbol prefix/suffix patterns
const SECTOR_MAP: Record<string, string[]> = {
  'Commercial Bank':          ['NABIL','EBL','NICA','SBI','ADBL','BOKL','CCBL','CBL','CZBIL','GBIME','HBL','KBL','LBL','MBL','NBB','NBL','NCCB','NIB','NMB','PCBL','PRVU','SANB','SCB','SRBL','SHBL','MAXA','MEGA','NIMB','JBNL','SUNBL','LBBL','BNBL'],
  'Development Bank':         ['DDBL','EDBL','GBBL','GRDBL','ICFC','JBBL','KBBL','LSBBL','MLBL','MNBBL','MPBL','MRGD','NABBC','ODBL','SADBL','SAPDBL','SBBL','SDBL','SINDU','SPDBL','SSBL','TBBL','WBBL','CORBL','KSBBL','RIPDBL','SSDBL','PBBL','BPCL','EDCL','RBBI','HAMRO'],
  'Finance':                  ['CFCL','GUFL','GFCL','ICC','IFIC','JFL','MFIL','NFCL','PROFL','SFCL','SIFC','SKFL','UFL','UNIQA','AFCL','BFC','CBFIN','CMF','FMDBL','NCFL','NFIL','PAFAN','MPFL','RLFL','SVFL'],
  'Microfinance':             ['MFBS','SMFBS','GMFBS','RMDC','SWMF','UNLB','WNLB','NICLBSL','MLBSL','SKDBL','FOWAD','NIRDHAN','NSLBBL','SWBBL','GILBSL','SLBSL','AKPL','GLBSL','JBLB','KMFL','NESDO','NMFBS','SDESI','SLBBL','SMFL','CBBL'],
  'Life Insurance':           ['ALICL','CLI','GLICL','ILI','JLIC','LICN','MLIC','NLIC','PCLI','PMLI','SNLI','SLI','RNLI','SRLI','NILI','ULIF','PLIT','NWCL'],
  'Non-Life Insurance':       ['AIL','HGICL','HGI','IGI','LGIL','NIC','NLICL','NIL','PICL','PLIC','PRIN','RBCL','RIMCL','SALICL','SGIC','SICL','SLICL','TICL','UAIL','API','SEIT'],
  'Hydropower':               ['AHPC','BARUN','BEDC','BHPL','BHL','CHCL','DHPL','DOLTI','HDHPC','HPPL','HURJA','KBHPL','KPCL','LBHPL','MBJCL','MKCL','MKJC','MMKJL','NHDL','NHPC','NPCBL','NYADI','PPCL','RADHI','RHCL','RIDI','RURU','SANJEN','SAHAS','SJCL','SMPL','SPDL','SRPL','SSHL','TMHL','UHEWA','UPCL','USHEC','USHL','YETI','NGPL','KKHC','UPPER','RURU','RURU'],
  'Hotel & Tourism':          ['EVRL','OHL','TRH','YHL','MHCL','SHIVM','SHL'],
  'Manufacturing and Processing': ['BSML','HDL','GCIL','BNHC','NTC','STC','NIFRA','UNL','SAIL','NBBL'],
  'Investment':               ['CHDC','CIT','HIDCL','NIFRA','NIL'],
  'Trading':                  ['BBC','STC','NRIC'],
}

export async function POST() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let updated = 0

  try {
    // Ensure all sectors exist
    for (const sectorName of Object.keys(SECTOR_MAP)) {
      await nepsePool.query('INSERT IGNORE INTO sector (name) VALUES (?)', [sectorName])
    }

    // Get all sectors
    const [sectorRows] = await nepsePool.query<RowDataPacket[]>('SELECT sector_id, name FROM sector')
    const sectorMap = new Map<string, number>(
      (sectorRows as RowDataPacket[]).map(r => [String(r.name), Number(r.sector_id)])
    )

    // Get all companies
    const [companies] = await nepsePool.query<RowDataPacket[]>('SELECT company_id, symbol FROM company')

    for (const company of companies as RowDataPacket[]) {
      const sym = String(company.symbol).toUpperCase()
      let assignedSector = ''

      for (const [sector, symbols] of Object.entries(SECTOR_MAP)) {
        if (symbols.includes(sym)) { assignedSector = sector; break }
      }

      if (assignedSector && sectorMap.has(assignedSector)) {
        const sectorId = sectorMap.get(assignedSector)!
        await nepsePool.query(
          'UPDATE company SET sector_id = ? WHERE company_id = ? AND sector_id = (SELECT sector_id FROM sector WHERE name = "Others" LIMIT 1)',
          [sectorId, company.company_id]
        )
        updated++
      }
    }

    return NextResponse.json({ success: true, updated, message: `Updated ${updated} companies with correct sectors` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}