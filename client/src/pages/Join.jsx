import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Logo from '../components/Logo.jsx';
import { get, post } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

export default function Join() {
  const { token } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invite = useQuery({ queryKey: ['invite', token], queryFn: () => get(`/invites/${token}`), retry: false });
  const accept = useMutation({
    mutationFn: () => post(`/invites/${token}/accept`),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ['me'] });
      navigate(`/app/c/${r.circleId}/today`, { replace: true });
    },
    onError: async (e) => {
      // Already a member: just take them to the circle.
      if (e.status === 409 && e.details?.circleId) {
        await qc.invalidateQueries({ queryKey: ['me'] });
        navigate(`/app/c/${e.details.circleId}/today`, { replace: true });
      }
    },
  });
  const next = encodeURIComponent(`/join/${token}`);

  return (
    <div className="center-page">
      <Logo />
      <div className="card join-card tape">
        {invite.isLoading || loading ? (
          <div className="skeleton" style={{ height: 160 }} />
        ) : invite.isError ? (
          <>
            <p className="kicker">Invite</p>
            <h1>This link doesn't work any more.</h1>
            <p className="muted">{invite.error.message}</p>
            <Link className="btn" to="/">
              Go to the home page
            </Link>
          </>
        ) : (
          <>
            <p className="kicker">You're invited</p>
            <h1>
              Join {invite.data.callName}'s circle
              {invite.data.city ? <span className="muted"> in {invite.data.city}</span> : null}
            </h1>
            <p className="muted">
              {invite.data.invitedBy} added you{invite.data.relation ? ` as ${invite.data.relation.toLowerCase()}` : ''}. You'll see {invite.data.callName}'s daily
              check-in, and you'll be alerted in your turn if it doesn't come. {invite.data.members} {invite.data.members === 1 ? 'person is' : 'people are'} in the circle.
            </p>
            {accept.isError && accept.error.status !== 409 && <div className="alert alert-error">{accept.error.message}</div>}
            {user ? (
              <button className="btn btn-primary btn-block" onClick={() => accept.mutate()} disabled={accept.isPending}>
                {accept.isPending ? 'Joining...' : `Join as ${user.name}`}
              </button>
            ) : (
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <Link className="btn btn-primary" to={`/signup?next=${next}`}>
                  Create an account to join
                </Link>
                <Link className="btn" to={`/login?next=${next}`}>
                  I have an account
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
