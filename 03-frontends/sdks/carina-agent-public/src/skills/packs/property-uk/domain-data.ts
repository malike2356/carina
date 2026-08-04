import hmoRoomSizes from './data/hmo-room-sizes.json' with { type: 'json' };
import {
  registerDomainLookupSource,
  type DomainLookupContext,
  type DomainLookupResult,
} from '../../../tools/domain-lookup.js';

interface HmoRoomSizesDataset {
  dataset: string;
  jurisdiction: string;
  sources: Array<{ title: string; url?: string; note?: string }>;
  standards: Record<string, unknown>;
  postcodeAreaIndex: Record<string, { standard: string; localAuthorityHint?: string; notes?: string[] }>;
}

const dataset = hmoRoomSizes as HmoRoomSizesDataset;

function postcodeArea(value: string): string {
  const match = value.trim().toUpperCase().match(/^[A-Z]{1,2}/);
  return match?.[0] ?? '';
}

function lookupHmoMinimumRoomSize(
  key: string,
  context: DomainLookupContext,
): DomainLookupResult {
  const postcode = typeof context.postcode === 'string' ? context.postcode : '';
  const area = postcode
    ? postcodeArea(postcode)
    : String(context.postcodeArea ?? context.area ?? '').trim().toUpperCase();

  if (!area) {
    return {
      found: false,
      key,
      pack: 'property-uk',
      sources: dataset.sources,
      message: 'Provide a UK postcode or postcodeArea to look up HMO room-size data.',
    };
  }

  const indexed = dataset.postcodeAreaIndex[area];
  if (!indexed) {
    return {
      found: false,
      key,
      pack: 'property-uk',
      sources: dataset.sources,
      message: `No static HMO room-size postcode index is available for postcode area "${area}".`,
    };
  }

  return {
    found: true,
    key,
    pack: 'property-uk',
    title: 'HMO minimum sleeping-room sizes',
    data: {
      postcodeArea: area,
      jurisdiction: dataset.jurisdiction,
      localAuthorityHint: indexed.localAuthorityHint,
      standard: dataset.standards[indexed.standard],
      indexNotes: indexed.notes ?? [],
    },
    sources: dataset.sources,
  };
}

registerDomainLookupSource({
  pack: 'property-uk',
  keyPattern: 'hmo_minimum_room_size',
  lookup: lookupHmoMinimumRoomSize,
});
