// E-com.casa — V2 taxonomy assignment types
export interface CatalogAssignment {
  category: string;
  subcategories: string[];
  spaces: string[];
  styles: string[];
  collections: string[];
  categoryConfidence?: number;
  styleConfidence?: number;
  collectionsConfidence?: number;
  countryFit?: Record<string, string>;
}
