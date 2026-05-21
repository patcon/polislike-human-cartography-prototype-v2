/**
 * Pure statistical functions for polis-style representative statement and consensus analysis.
 * Algorithms originally derived from raykyri/osccai-simulation (src/utils).
 * DB-layer types and query helpers live in db.ts.
 */

// Type definitions
export interface BasicCommentStats {
  na: number;
  nd: number;
  ns: number;
  pa: number;
  pd: number;
  pat: number;
  pdt: number;
}

export interface CommentStats extends BasicCommentStats {
  ra: number;
  rd: number;
  rat: number;
  rdt: number;
}

export interface FinalizedCommentStats {
  tid: string | number;
  n_agree: number;
  n_disagree: number;
  n_pass: number;
  n_success: number;
  n_trials: number;
  p_success: number;
  p_test: number;
  repness: number;
  repness_test: number;
  repful_for: string;
  best_agree?: boolean;
}

export interface GroupVoteMatrix {
  [participantId: string]: {
    [commentId: string]: number;
  };
}

export interface ConsensusStatement {
  tid: number;
  n_success: number;
  n_trials: number;
  p_success: number;
  p_test: number;
  cons_for: string;
}

const Config = {
  stats: {
    // One-tailed z-test at 90% confidence: upper-tail probability = 0.10 → z = 1.2816.
    // Polis tests whether a group's support rate is *higher than baseline* (directional),
    // so a one-tailed threshold is correct here.
    significanceThreshold: 1.2816,
    minVotes: 7,
  }
};

/**
 * Check if z-score is significant at 90% confidence.
 */
export function zSig90(zVal: number): boolean {
  return zVal > Config.stats.significanceThreshold;
}

/**
 * Two-proportion z-test.
 */
export function twoPropTest(succIn: number, succOut: number, popIn: number, popOut: number): number {
  const adjustedSuccIn = succIn + 1;
  const adjustedSuccOut = succOut + 1;
  const adjustedPopIn = popIn + 1;
  const adjustedPopOut = popOut + 1;

  const pi1 = adjustedSuccIn / adjustedPopIn;
  const pi2 = adjustedSuccOut / adjustedPopOut;
  const piHat = (adjustedSuccIn + adjustedSuccOut) / (adjustedPopIn + adjustedPopOut);

  if (piHat === 1) return 0;

  return (
    (pi1 - pi2) /
    Math.sqrt(
      piHat * (1 - piHat) * (1 / adjustedPopIn + 1 / adjustedPopOut),
    )
  );
}

/**
 * Proportion test.
 */
export function propTest(succ: number, n: number): number {
  const adjustedSucc = succ + 1;
  const adjustedN = n + 1;
  return 2 * Math.sqrt(adjustedN) * (adjustedSucc / adjustedN - 0.5);
}

/**
 * Add comparative statistics (in-group vs. all other groups).
 */
export function addComparativeStats(inStats: BasicCommentStats, restStats: BasicCommentStats[]): CommentStats {
  const sumOtherNa = restStats.reduce((sum, g) => sum + g.na, 0);
  const sumOtherNd = restStats.reduce((sum, g) => sum + g.nd, 0);
  const sumOtherNs = restStats.reduce((sum, g) => sum + g.ns, 0);

  const ra = inStats.pa / ((1 + sumOtherNa) / (2 + sumOtherNs));
  const rd = inStats.pd / ((1 + sumOtherNd) / (2 + sumOtherNs));

  const rat = twoPropTest(inStats.na, sumOtherNa, inStats.ns, sumOtherNs);
  const rdt = twoPropTest(inStats.nd, sumOtherNd, inStats.ns, sumOtherNs);

  return {
    ...inStats,
    ra,
    rd,
    rat,
    rdt,
  };
}

/**
 * Check if a comment passes the significance test.
 */
export function passesByTest(commentStats: CommentStats): boolean {
  return (
    (zSig90(commentStats.rat) && zSig90(commentStats.pat)) ||
    (zSig90(commentStats.rdt) && zSig90(commentStats.pdt))
  );
}

/**
 * Check if a comment beats the current best by z-score.
 */
export function beatsBestByTest(commentStats: CommentStats, currentBestZ: number | null): boolean {
  return (
    currentBestZ === null ||
    Math.max(commentStats.rat, commentStats.rdt) > currentBestZ
  );
}

/**
 * Check if a comment beats the current best by agreement metric.
 */
export function beatsBestAgr(commentStats: CommentStats, currentBest: CommentStats | null): boolean {
  const { na, nd, ra, rat, pa, pat } = commentStats;
  if (na === 0 && nd === 0) return false;
  if (currentBest && currentBest.ra > 1.0) {
    return (
      ra * rat * pa * pat >
      currentBest.ra * currentBest.rat * currentBest.pa * currentBest.pat
    );
  }
  if (currentBest) {
    return pa * pat > currentBest.pa * currentBest.pat;
  }
  return zSig90(pat) || (ra > 1.0 && pa > 0.5);
}

/**
 * Finalize comment statistics into the display format.
 */
export function finalizeCommentStats(tid: string | number, stats: CommentStats): FinalizedCommentStats {
  const { na, nd, ns, pa, pd, pat, pdt, ra, rd, rat, rdt } = stats;
  const isAgreeMoreRep =
    (rat > rdt && na >= Config.stats.minVotes) ||
    nd < Config.stats.minVotes;
  const repful_for = isAgreeMoreRep ? "agree" : "disagree";

  return {
    tid,
    n_agree: na,
    n_disagree: nd,
    n_pass: ns - na - nd,
    n_success: isAgreeMoreRep ? na : nd,
    n_trials: ns,
    p_success: isAgreeMoreRep ? pa : pd,
    p_test: isAgreeMoreRep ? pat : pdt,
    repness: isAgreeMoreRep ? ra : rd,
    repness_test: isAgreeMoreRep ? rat : rdt,
    repful_for,
  };
}

/**
 * Calculate the repness metric for ranking.
 */
export function repnessMetric(data: FinalizedCommentStats): number {
  return data.repness * data.repness_test * data.p_success * data.p_test;
}

/**
 * Select representative comments per group from pre-computed stats.
 */
export function selectRepComments(
  commentStatsWithTid: [string | number, Record<string, CommentStats>][],
  pickMax: number | null = null,
  options: {
    includeModerated?: boolean;
    minVoteCount?: number;
    maxStatementsCount?: number;
    commentTextMap?: Record<string, unknown>;
  } = {}
): Record<string, FinalizedCommentStats[]> {
  const {
    includeModerated = false,
    minVoteCount = 1,
    maxStatementsCount = 10,
    commentTextMap = {}
  } = options;

  const result: Record<string, {
    best: FinalizedCommentStats | null;
    best_agree: (CommentStats & { tid: string | number }) | null;
    sufficient: FinalizedCommentStats[];
  }> = {};

  if (commentStatsWithTid.length === 0) return {};

  const groupIds = Object.keys(commentStatsWithTid[0][1]);

  groupIds.forEach((gid) => {
    result[gid] = { best: null, best_agree: null, sufficient: [] };
  });

  commentStatsWithTid.forEach(([tid, groupsData]) => {
    const comment = (commentTextMap as Record<string, { mod?: string | number }>)[tid as string];
    const isModerated = comment?.mod === "-1" || comment?.mod === -1;
    if (isModerated && !includeModerated) return;

    Object.entries(groupsData).forEach(([gid, commentStats]: [string, CommentStats]) => {
      const groupResult = result[gid];

      if (commentStats.ns < minVoteCount) {
        return;
      }

      if (passesByTest(commentStats)) {
        groupResult.sufficient.push(
          finalizeCommentStats(tid, commentStats),
        );
      }

      if (
        beatsBestByTest(
          commentStats,
          groupResult.best?.repness_test || null,
        )
      ) {
        groupResult.best = finalizeCommentStats(tid, commentStats);
      }

      if (beatsBestAgr(commentStats, groupResult.best_agree)) {
        groupResult.best_agree = { ...commentStats, tid } as CommentStats & { tid: string | number };
      }
    });
  });

  const finalResult: Record<string, FinalizedCommentStats[]> = {};

  Object.entries(result).forEach(
    ([gid, { best, best_agree, sufficient }]) => {
      let bestAgreeComment: FinalizedCommentStats | null = null;
      if (best_agree) {
        bestAgreeComment = finalizeCommentStats(
          best_agree.tid,
          best_agree,
        );
        bestAgreeComment.best_agree = true;
      }

      // Fall back to the single best comment when no statement passed significance
      if (sufficient.length === 0) {
        finalResult[gid] = best ? [best] : [];
        return;
      }

      let selectedComments: FinalizedCommentStats[] = [];
      if (bestAgreeComment) {
        selectedComments.push(bestAgreeComment);
        sufficient = sufficient.filter(
          (c: FinalizedCommentStats) => c.tid !== bestAgreeComment!.tid,
        );
      }

      const sortedSufficient = sufficient.sort(
        (a: FinalizedCommentStats, b: FinalizedCommentStats) => repnessMetric(b) - repnessMetric(a),
      );

      selectedComments = [...selectedComments, ...sortedSufficient];

      const maxCount = pickMax !== null && pickMax !== undefined ? pickMax : Math.floor(maxStatementsCount);

      finalResult[gid] = selectedComments.slice(0, maxCount);
    },
  );

  return finalResult;
}

/**
 * Check if a z-score (or proportion-test value) is significant at 90% confidence, one-tailed.
 */
export function isSignificant(pValue: number): boolean {
  return zSig90(Math.abs(pValue));
}

/**
 * Select consensus statements agreed or disagreed upon across all groups.
 */
export function selectConsensusStatements(
  groupVotes: Record<string, GroupVoteMatrix>,
  modOutStatementIds: number[] = [],
  pickMax: number | null = null,
  probThreshold: number = 0.5,
  options: {
    minVoteCount?: number;
    maxStatementsCount?: number;
  } = {}
): { agree: ConsensusStatement[]; disagree: ConsensusStatement[] } {
  const {
    minVoteCount = 1,
    maxStatementsCount = 10
  } = options;

  const allCommentIds = new Set<number>();
  Object.values(groupVotes).forEach((groupMatrix: GroupVoteMatrix) => {
    Object.values(groupMatrix).forEach((participantVotes: Record<string, number>) => {
      Object.keys(participantVotes).forEach((commentId) => {
        allCommentIds.add(parseInt(commentId));
      });
    });
  });

  const commentIds = Array.from(allCommentIds)
    .filter((id) => !modOutStatementIds.includes(id))
    .sort((a, b) => a - b);

  const statements: Array<{
    tid: number;
    na: number;
    nd: number;
    ns: number;
    pa: number;
    pd: number;
    pat: number;
    pdt: number;
    agreeMetric: number;
    disagreeMetric: number;
  }> = [];

  commentIds.forEach((commentId) => {
    let totalAgrees = 0;
    let totalDisagrees = 0;
    let totalSeen = 0;

    Object.values(groupVotes).forEach((groupMatrix: GroupVoteMatrix) => {
      Object.values(groupMatrix).forEach((participantVotes: Record<string, number>) => {
        const vote = participantVotes[commentId];
        if (vote !== undefined) {
          totalSeen++;
          if (vote === 1) totalAgrees++;
          else if (vote === -1) totalDisagrees++;
        }
      });
    });

    if (totalSeen === 0) return;
    if (totalSeen < minVoteCount) return;

    const pa = (totalAgrees + 1) / (totalSeen + 2);
    const pd = (totalDisagrees + 1) / (totalSeen + 2);

    const pat = propTest(totalAgrees, totalSeen);
    const pdt = propTest(totalDisagrees, totalSeen);

    const agreeMetric = pa * pat;
    const disagreeMetric = pd * pdt;

    statements.push({
      tid: commentId,
      na: totalAgrees,
      nd: totalDisagrees,
      ns: totalSeen,
      pa,
      pd,
      pat,
      pdt,
      agreeMetric,
      disagreeMetric,
    });
  });

  let agreeCandidates = statements
    .filter((s) => s.pa > probThreshold && isSignificant(s.pat))
    .sort((a, b) => b.agreeMetric - a.agreeMetric);

  const maxAgree = pickMax !== null && pickMax !== undefined ? pickMax : Math.floor(maxStatementsCount / 2);
  agreeCandidates = agreeCandidates.slice(0, maxAgree);

  let disagreeCandidates = statements
    .filter((s) => s.pd > probThreshold && isSignificant(s.pdt))
    .sort((a, b) => b.disagreeMetric - a.disagreeMetric);

  const maxDisagree = pickMax !== null && pickMax !== undefined ? pickMax : Math.floor(maxStatementsCount / 2);
  disagreeCandidates = disagreeCandidates.slice(0, maxDisagree);

  const formatStatement = (stmt: typeof statements[0], isAgree: boolean): ConsensusStatement => ({
    tid: stmt.tid,
    n_success: isAgree ? stmt.na : stmt.nd,
    n_trials: stmt.ns,
    p_success: isAgree ? stmt.pa : stmt.pd,
    p_test: isAgree ? stmt.pat : stmt.pdt,
    cons_for: isAgree ? "agree" : "disagree",
  });

  return {
    agree: agreeCandidates.map((s) => formatStatement(s, true)),
    disagree: disagreeCandidates.map((s) => formatStatement(s, false)),
  };
}

/**
 * Calculate representative comments per group from pre-fetched vote matrices.
 */
export function calculateRepresentativeComments(
  groupVotes: Record<string, GroupVoteMatrix>,
  commentTexts?: Array<{ id: number }>,
  options: {
    includeModerated?: boolean;
    minVoteCount?: number;
    maxStatementsCount?: number;
    commentTextMap?: Record<string, unknown>;
  } = {}
): Record<string, FinalizedCommentStats[]> {
  const allComments = commentTexts
    ? commentTexts.map((c) => c.id)
    : Array.from(
        new Set(
          Object.values(groupVotes)
            .flatMap((group) => Object.values(group))
            .flatMap((votes: Record<string, number>) => Object.keys(votes).map(Number)),
        ),
      ).sort((a, b) => a - b);

  const commentStatsWithTid: [number, Record<string, BasicCommentStats>][] = [];

  allComments.forEach((commentId) => {
    const commentStats: Record<string, BasicCommentStats> = {};

    for (const [groupId, groupMatrix] of Object.entries(groupVotes)) {
      let agrees = 0,
        disagrees = 0,
        passes = 0,
        seen = 0;

      for (const voteRow of Object.values(groupMatrix)) {
        const vote = (voteRow as Record<string, number>)[commentId];
        if (vote != null) {
          seen++;
          if (vote === 1) agrees++;
          else if (vote === -1) disagrees++;
          else passes++;
        }
      }

      const pa = (agrees + 1) / (seen + 2);
      const pd = (disagrees + 1) / (seen + 2);
      const pat = propTest(agrees, seen);
      const pdt = propTest(disagrees, seen);

      commentStats[groupId] = {
        na: agrees,
        nd: disagrees,
        ns: seen,
        pa,
        pd,
        pat,
        pdt,
      };
    }

    commentStatsWithTid.push([commentId, commentStats]);
  });

  const withComparatives = commentStatsWithTid.map(([tid, stats]) => {
    const processed: Record<string, CommentStats> = {};
    for (const [gid, stat] of Object.entries(stats)) {
      const rest = Object.entries(stats)
        .filter(([otherGid]) => otherGid !== gid)
        .map(([, s]) => s);
      processed[gid] = addComparativeStats(stat, rest);
    }
    return [tid, processed] as [number, Record<string, CommentStats>];
  });

  return selectRepComments(withComparatives, null, options);
}

