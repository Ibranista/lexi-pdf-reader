import classes from './animated-icon.module.css';

export function AnimatedSplashOverlay() {
  return null;
}

export function AnimatedIcon() {
  return (
    <div className={classes.tile}>
      <svg width="80" height="80" viewBox="0 0 44 44" style={{ overflow: 'visible' }}>
        <g className={classes.contents}>
          <rect className={classes.dot} x="29" y="8" width="8" height="8" rx="4" fill="#CD632D" />
          <rect className={classes.stem} x="10" y="6" width="9" height="30" rx="2" fill="#FDFBF8" />
          <rect className={classes.foot} x="10" y="29" width="24" height="9" rx="2" fill="#CD632D" />
          <path className={classes.fold} d="M35.5 5.5 L38.5 5.5 L38.5 8.5 Z" fill="#201B15" />
          <path
            className={classes.fold}
            d="M35.5 5.5 L38.5 8.5 L35.5 8.5 Z"
            fill="#FDFBF8"
            fillOpacity="0.9"
          />
          <path
            className={classes.line1}
            d="M30 9.5 H34.5"
            stroke="#FDFBF8"
            strokeOpacity="0.9"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray="7"
          />
          <path
            className={classes.line2}
            d="M30 12.5 H36.5"
            stroke="#FDFBF8"
            strokeOpacity="0.9"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray="7"
          />
          <path
            className={classes.line3}
            d="M30 15.5 H33.5"
            stroke="#FDFBF8"
            strokeOpacity="0.9"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray="7"
          />
        </g>
      </svg>
    </div>
  );
}
