# DexScreener Filter Parameters Reference

Complete guide to URL filter parameters for DexScreener.com.

## URL Structure

```
https://dexscreener.com/[page]?[parameters]
```

Examples:
- `https://dexscreener.com/new-pairs?minLiq=10000`
- `https://dexscreener.com/new-pairs?minLiq=10000&maxAge=24&min24HChg=10`
- `https://dexscreener.com/new-pairs/solana?rankBy=trendingScoreH6&order=desc`

## Quick Reference

### Sorting/Ranking
| Parameter | Values | Description |
|-----------|--------|-------------|
| `rankBy` | `trendingScoreH6`, `trendingScoreH24`, `trendingScoreD7`, `volume`, `liquidity` | Ranking method |
| `order` | `desc`, `asc` | Sort order (descending/ascending) |

### Basic Filters
| Parameter | Description | Example |
|-----------|-------------|---------|
| `minLiq` | Minimum liquidity in USD | `minLiq=10000` ($10,000) |
| `maxLiq` | Maximum liquidity in USD | `maxLiq=100000` ($100,000) |
| `minAge` | Minimum pair age in hours | `minAge=1` (1 hour) |
| `maxAge` | Maximum pair age in hours | `maxAge=24` (24 hours) |
| `minMarketCap` | Minimum market cap in USD | `minMarketCap=1000` |
| `maxMarketCap` | Maximum market cap in USD | `maxMarketCap=1000000` |
| `minFdv` | Minimum FDV in USD | `minFdv=1` |
| `maxFdv` | Maximum FDV in USD | `maxFdv=10` |

## Time-Based Metrics

### 24-Hour Metrics
| Parameter | Description | Example |
|-----------|-------------|---------|
| `min24HTxns` | Minimum 24h transactions | `min24HTxns=10` |
| `max24HTxns` | Maximum 24h transactions | `max24HTxns=100` |
| `min24HBuys` | Minimum 24h buys | `min24HBuys=1` |
| `max24HBuys` | Maximum 24h buys | `max24HBuys=10` |
| `min24HSells` | Minimum 24h sells | `min24HSells=1` |
| `max24HSells` | Maximum 24h sells | `max24HSells=10` |
| `min24HVol` | Minimum 24h volume | `min24HVol=1000` |
| `max24HVol` | Maximum 24h volume | `max24HVol=10000` |
| `min24HChg` | Minimum 24h % change | `min24HChg=10` (10%) |
| `max24HChg` | Maximum 24h % change | `max24HChg=100` (100%) |

### 6-Hour Metrics
| Parameter | Description | Example |
|-----------|-------------|---------|
| `min6HTxns` | Minimum 6h transactions | `min6HTxns=5` |
| `max6HTxns` | Maximum 6h transactions | `max6HTxns=50` |
| `min6HBuys` | Minimum 6h buys | `min6HBuys=1` |
| `max6HBuys` | Maximum 6h buys | `max6HBuys=10` |
| `min6HSells` | Minimum 6h sells | `min6HSells=1` |
| `max6HSells` | Maximum 6h sells | `max6HSells=10` |
| `min6HVol` | Minimum 6h volume | `min6HVol=1000` |
| `max6HVol` | Maximum 6h volume | `max6HVol=10000` |
| `min6HChg` | Minimum 6h % change | `min6HChg=5` (5%) |
| `max6HChg` | Maximum 6h % change | `max6HChg=50` (50%) |

### 1-Hour Metrics
| Parameter | Description | Example |
|-----------|-------------|---------|
| `min1HTxns` | Minimum 1h transactions | `min1HTxns=1` |
| `max1HTxns` | Maximum 1h transactions | `max1HTxns=20` |
| `min1HBuys` | Minimum 1h buys | `min1HBuys=1` |
| `max1HBuys` | Maximum 1h buys | `max1HBuys=10` |
| `min1HSells` | Minimum 1h sells | `min1HSells=1` |
| `max1HSells` | Maximum 1h sells | `max1HSells=10` |
| `min1HVol` | Minimum 1h volume | `min1HVol=500` |
| `max1HVol` | Maximum 1h volume | `max1HVol=5000` |
| `min1HChg` | Minimum 1h % change | `min1HChg=3` (3%) |
| `max1HChg` | Maximum 1h % change | `max1HChg=30` (30%) |

### 5-Minute Metrics
| Parameter | Description | Example |
|-----------|-------------|---------|
| `min5MTxns` | Minimum 5m transactions | `min5MTxns=1` |
| `max5MTxns` | Maximum 5m transactions | `max5MTxns=10` |
| `min5MBuys` | Minimum 5m buys | `min5MBuys=1` |
| `max5MBuys` | Maximum 5m buys | `max5MBuys=5` |
| `min5MSells` | Minimum 5m sells | `min5MSells=1` |
| `max5MSells` | Maximum 5m sells | `max5MSells=5` |
| `min5MVol` | Minimum 5m volume | `min5MVol=100` |
| `max5MVol` | Maximum 5m volume | `max5MVol=1000` |
| `min5MChg` | Minimum 5m % change | `min5MChg=1` (1%) |
| `max5MChg` | Maximum 5m % change | `max5MChg=10` (10%) |

## Common Filter Combinations

### High Liquidity New Pairs
```
?minLiq=100000&maxAge=24&order=desc
```
Filters: Minimum $100k liquidity, created within 24 hours

### Big Winners (24h)
```
?minLiq=50000&min24HVol=100000&min24HChg=50&order=desc
```
Filters: $50k+ liquidity, $100k+ volume, +50% price change

### Very New Pairs (Last Hour)
```
?maxAge=1&minLiq=50000&min1HVol=50000&order=desc
```
Filters: Under 1 hour old, $50k+ liquidity and volume

### Trending Pairs (6h)
```
?minLiq=25000&min6HVol=25000&min6HChg=10&rankBy=trendingScoreH6&order=desc
```
Filters: $25k+ liquidity and volume, +10% change, ranked by 6h trending

### Stable Rising Pairs
```
?minLiq=50000&min24HVol=100000&min24HChg=5&max24HChg=30&min24HBuys=100
```
Filters: $50k+ liquidity, $100k+ volume, +5% to +30% change, active buy pressure

## Usage with Extension

The extension automatically detects filter URL changes and opens new tabs. Example workflow:

1. **Navigate to base URL:**
   ```
   https://dexscreener.com/new-pairs/solana
   ```

2. **Add first filter:**
   ```
   https://dexscreener.com/new-pairs/solana?rankBy=trendingScoreH6&order=desc&minLiq=10000
   ```
   → Extension opens a new tab with this filter

3. **Try different filter:**
   ```
   https://dexscreener.com/new-pairs/solana?minLiq=50000&maxAge=12&order=desc
   ```
   → Extension opens another new tab

4. **Compare results** side-by-side in different tabs

## Parameter Value Guidelines

### Numbers (Liquidity, Volume, Market Cap, FDV)
- No commas in values
- Example: $10,000 → `10000`
- Example: $1,000,000 → `1000000`

### Percentages (Price Change)
- No % symbol
- Example: 10% → `10`
- Example: 50% → `50`

### Counts (Transactions, Buys, Sells)
- Whole numbers only
- Example: 10 transactions → `10`

### Time (Age)
- Measured in hours
- Example: 24 hours → `24`
- Example: 1 hour → `1`

## Important Notes

1. **Multiple parameters** are joined with `&`
   ```
   ?param1=value1&param2=value2&param3=value3
   ```

2. **All parameters are optional** - include only what you need

3. **Values are case-sensitive** for ranking methods

4. **The extension** will automatically open filter URL tabs for easy comparison

5. **Time periods**:
   - Age: always in hours
   - Metrics: H = hours, M = minutes

## Extension Integration

When you modify filter parameters in the URL:
- The extension detects the change automatically
- Opens a new tab with the filtered view
- Prevents duplicate filter URLs

This allows you to quickly compare different filter combinations side-by-side.

